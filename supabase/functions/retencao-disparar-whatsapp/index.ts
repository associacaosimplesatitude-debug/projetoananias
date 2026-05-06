import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  let p = raw.replace(/\D/g, "");
  if (p.startsWith("0")) p = p.slice(1);
  if (!p.startsWith("55")) p = "55" + p;
  if (p.length < 12) return null;
  return p;
}

console.log("[retencao-disparar-whatsapp] função iniciada");

Deno.serve(async (req) => {
  console.log("[retencao-disparar-whatsapp] request recebido", req.method);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const allowed = (roles || []).some((r: any) => r.role === "admin" || r.role === "gerente_ebd");
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    console.log("[retencao-disparar-whatsapp] body recebido:", JSON.stringify(body));
    const faixa: string = body.faixa;
    const excluirRecentes: boolean = body.excluir_recentes !== false;
    const rawNumerosTeste: any[] = Array.isArray(body.numeros_teste) ? body.numeros_teste : [];
    const detalhes: any[] = Array.isArray(body.numeros_teste_detalhes) ? body.numeros_teste_detalhes : [];
    const numerosTeste: Array<{ nome: string; telefone: string }> = rawNumerosTeste.map((item, idx) => {
      if (typeof item === "string") {
        const det = detalhes[idx];
        return { nome: det?.nome || "Teste", telefone: item };
      }
      return { nome: item?.nome || "Teste", telefone: item?.telefone || "" };
    }).filter((n) => n.telefone);
    const isTeste = numerosTeste.length > 0 || body.isTeste === true;

    if (!isTeste && !["atencao", "critico", "urgente"].includes(faixa)) {
      return new Response(JSON.stringify({ error: "Faixa inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Settings WhatsApp
    const { data: settings } = await admin
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: any) => { settingsMap[s.key] = s.value; });
    const phoneNumberId = settingsMap["whatsapp_phone_number_id"];
    const accessToken = settingsMap["whatsapp_access_token"];
    if (!phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: "WhatsApp não configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let alvo: any[] = [];
    if (isTeste) {
      alvo = numerosTeste.map((n) => ({
        cliente_id: null,
        nome_igreja: n.nome,
        telefone: n.telefone,
        vendedor_nome: null,
      }));
    } else {
      const { data: dash, error: dashErr } = await admin.rpc("get_retencao_dashboard", { p_vendedor_id: null });
      if (dashErr) throw dashErr;
      const clientes: any[] = (dash as any)?.kanban_clientes || [];
      const inFaixa = clientes.filter((c) => {
        const d = c.dias_sem_compra || 0;
        if (faixa === "atencao") return d >= 30 && d < 60;
        if (faixa === "critico") return d >= 60 && d < 90;
        return d >= 90;
      });
      alvo = inFaixa;
      if (excluirRecentes && alvo.length > 0) {
        const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ids = alvo.map((c) => c.cliente_id);
        const { data: recentes } = await admin
          .from("retencao_disparos")
          .select("cliente_id")
          .eq("status", "sucesso")
          .gt("enviado_em", cutoff)
          .in("cliente_id", ids);
        const exclSet = new Set((recentes || []).map((r: any) => r.cliente_id));
        alvo = alvo.filter((c) => !exclSet.has(c.cliente_id));
      }
    }

    let sucesso = 0;
    let falha = 0;
    const total = alvo.length;

    for (const c of alvo) {
      const tel = normalizePhone(c.telefone);
      if (!tel) {
        falha++;
        if (!isTeste) {
          await admin.from("retencao_disparos").insert({
            cliente_id: c.cliente_id,
            telefone: c.telefone || "",
            template_nome: "retencao_ebd_reengajamento",
            faixa,
            status: "falha",
            erro: "Telefone inválido",
            enviado_por: userId,
          });
        }
        continue;
      }

      const payload = {
        messaging_product: "whatsapp",
        to: tel,
        type: "template",
        template: {
          name: "retencao_ebd_reengajamento",
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: c.nome_igreja || "amigo(a)" },
                { type: "text", text: c.vendedor_nome || "nosso consultor" },
              ],
            },
          ],
        },
      };

      try {
        const resp = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const json = await resp.json();
        if (resp.ok && json?.messages?.[0]?.id) {
          sucesso++;
          if (!isTeste) {
            await admin.from("retencao_disparos").insert({
              cliente_id: c.cliente_id,
              telefone: tel,
              template_nome: "retencao_ebd_reengajamento",
              faixa,
              status: "sucesso",
              meta_message_id: json.messages[0].id,
              enviado_por: userId,
            });
          }
        } else {
          falha++;
          console.error("[retencao] Meta erro:", JSON.stringify(json));
          if (!isTeste) {
            await admin.from("retencao_disparos").insert({
              cliente_id: c.cliente_id,
              telefone: tel,
              template_nome: "retencao_ebd_reengajamento",
              faixa,
              status: "falha",
              erro: JSON.stringify(json).slice(0, 1000),
              enviado_por: userId,
            });
          }
        }
      } catch (e) {
        falha++;
        if (!isTeste) {
          await admin.from("retencao_disparos").insert({
            cliente_id: c.cliente_id,
            telefone: tel,
            template_nome: "retencao_ebd_reengajamento",
            faixa,
            status: "falha",
            erro: String(e).slice(0, 1000),
            enviado_por: userId,
          });
        }
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    return new Response(JSON.stringify({ total, sucesso, falha }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("retencao-disparar-whatsapp error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
