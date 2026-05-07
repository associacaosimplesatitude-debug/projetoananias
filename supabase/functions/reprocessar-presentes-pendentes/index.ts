import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_ACESSO = "https://gestaoebd.com.br/revista/acesso";

function normalizeForMeta(t: string): string {
  const d = (t || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55")) return d;
  return "55" + d;
}

async function sendText(phoneId: string, token: string, to: string, text: string) {
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`Meta: ${JSON.stringify(j)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);
  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: uerr } = await supabaseUser.auth.getUser();
  if (uerr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userData.user.id);
  const ok = (roles || []).some((r: any) => ["admin", "gerente_ebd"].includes(r.role));
  if (!ok) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Caso A — sem licença ainda
  const { data: pendentesA } = await supabaseAdmin
    .from("retencao_respostas")
    .select("id, cliente_id, telefone, created_at, ebd_clientes:cliente_id(nome_igreja, email_superintendente, vendedor_id)")
    .eq("tipo", "aceitar_presente")
    .is("licenca_concedida_em", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  // Caso B — com licença mas sem wa_acesso
  const { data: pendentesB } = await supabaseAdmin
    .from("retencao_respostas")
    .select("id, cliente_id, telefone, created_at, licenca_erro, ebd_clientes:cliente_id(nome_igreja)")
    .eq("tipo", "aceitar_presente")
    .not("licenca_concedida_em", "is", null)
    .is("wa_acesso_enviado_em", null)
    .gte("created_at", since)
    .order("created_at", { ascending: true });

  const totalA = pendentesA?.length || 0;
  const totalB = pendentesB?.length || 0;
  const total = totalA + totalB;

  if (!total) {
    return new Response(JSON.stringify({ total: 0, totalA: 0, totalB: 0 }), { headers: corsHeaders });
  }

  // Buscar settings Meta uma vez (para Caso B)
  const { data: settings } = await supabaseAdmin
    .from("system_settings")
    .select("key, value")
    .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);
  const sm: Record<string, string> = {};
  (settings || []).forEach((s: any) => { sm[s.key] = s.value; });

  const proc = async () => {
    let sucessoA = 0, falhaA = 0, sucessoB = 0, falhaB = 0;
    const erros: any[] = [];

    // Caso A
    for (const p of pendentesA || []) {
      const c: any = (p as any).ebd_clientes || {};
      let vendedor_nome = "seu consultor";
      if (c.vendedor_id) {
        const { data: v } = await supabaseAdmin.from("vendedores").select("nome").eq("id", c.vendedor_id).maybeSingle();
        if (v?.nome) vendedor_nome = v.nome;
      }
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/liberar-presente-cartas-prisao`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            cliente_id: p.cliente_id,
            telefone: p.telefone,
            nome: c.nome_igreja,
            email: c.email_superintendente,
            vendedor_nome,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.error) { falhaA++; erros.push({ caso: "A", cliente_id: p.cliente_id, error: j?.error || r.status }); }
        else sucessoA++;
      } catch (e: any) {
        falhaA++; erros.push({ caso: "A", cliente_id: p.cliente_id, error: e.message });
      }
      await new Promise((r) => setTimeout(r, 3000));
    }

    // Caso B — só wa_acesso direto via Meta
    for (const p of pendentesB || []) {
      const c: any = (p as any).ebd_clientes || {};
      const nomeOk = c.nome_igreja || "Cliente";
      const wMeta = normalizeForMeta(p.telefone || "");
      const ageMs = Date.now() - new Date(p.created_at).getTime();
      if (ageMs > 24 * 3600 * 1000) {
        await supabaseAdmin.from("retencao_respostas")
          .update({ licenca_erro: "wa_acesso_janela_fechada" })
          .eq("id", p.id);
        falhaB++;
        erros.push({ caso: "B", cliente_id: p.cliente_id, error: "janela_fechada" });
        continue;
      }
      try {
        const txt = `Ola, ${nomeOk}! Seu acesso a Cartas da Prisao (Professor + Infografico) esta liberado.\n\nAcesse:\n${URL_ACESSO}\n\nDigite seu WhatsApp para receber o codigo.`;
        await sendText(sm["whatsapp_phone_number_id"], sm["whatsapp_access_token"], wMeta, txt);
        await supabaseAdmin.from("retencao_respostas")
          .update({ wa_acesso_enviado_em: new Date().toISOString() })
          .eq("id", p.id);
        sucessoB++;
      } catch (e: any) {
        const msg = String(e.message || e);
        const tag = msg.includes("re-engagement") || msg.includes("131047") ? "wa_acesso_janela_fechada" : `wa_acesso_falhou: ${msg}`.slice(0, 500);
        await supabaseAdmin.from("retencao_respostas")
          .update({ licenca_erro: tag })
          .eq("id", p.id);
        falhaB++;
        erros.push({ caso: "B", cliente_id: p.cliente_id, error: msg });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    console.log("[reprocessar-presentes] done", { totalA, sucessoA, falhaA, totalB, sucessoB, falhaB, erros });
  };

  // @ts-ignore
  (globalThis as any).EdgeRuntime?.waitUntil ? (globalThis as any).EdgeRuntime.waitUntil(proc()) : proc();

  return new Response(JSON.stringify({ enqueued: true, total, totalA, totalB }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
