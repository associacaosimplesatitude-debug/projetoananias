// Envia mensagem do agente loja CG via Meta Cloud API e atualiza agente_ia_mensagens.
// Auth: somente Service Role Key (chamada server-to-server).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function log(msg: string, extra?: unknown) {
  if (extra !== undefined) console.log(`[agente-enviar-mensagem-whatsapp] ${msg}`, extra);
  else console.log(`[agente-enviar-mensagem-whatsapp] ${msg}`);
}

function formatPhone(phone: string): string {
  let cleaned = (phone || "").replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Aceita: (a) service role key direto, ou (b) JWT de usuário admin/superadmin/gerente
    let authorized = false;
    let userId: string | null = null;

    if (token === SERVICE_KEY) {
      authorized = true;
    } else if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const roleNames = (roles || []).map((r: any) => r.role);
        if (
          roleNames.includes("admin") ||
          roleNames.includes("superadmin") ||
          roleNames.includes("gerente_ebd")
        ) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const mensagem_id: string = body?.mensagem_id;
    const telefone_destino: string = body?.telefone_destino;
    const texto: string = body?.texto;

    if (!mensagem_id || !telefone_destino || !texto) {
      return jsonResponse({
        error: "mensagem_id, telefone_destino e texto são obrigatórios",
      }, 400);
    }

    log("recebido", { mensagem_id, telefone_destino, len: texto.length });

    // Carrega credenciais Meta
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", [
        "whatsapp_phone_number_id",
        "whatsapp_business_account_id",
        "whatsapp_access_token",
      ]);
    const sm: Record<string, string> = {};
    (settings || []).forEach((s: any) => { sm[s.key] = s.value; });

    const accessToken = sm["whatsapp_access_token"];
    const phoneNumberId = sm["whatsapp_phone_number_id"];

    if (!accessToken || !phoneNumberId) {
      const motivo = "envio_falhou: credenciais Meta não configuradas";
      log(motivo);
      await supabase
        .from("agente_ia_mensagens")
        .update({ status_aprovacao: "recusada", motivo_recusa: motivo })
        .eq("id", mensagem_id);
      return jsonResponse({ error: motivo }, 500);
    }

    const formattedPhone = formatPhone(telefone_destino);
    const graphUrl = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;
    const graphPayload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "text",
      text: { body: texto },
    };

    log("POST Meta", { graphUrl, to: formattedPhone });

    const graphRes = await fetch(graphUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(graphPayload),
    });

    const graphResult = await graphRes.json().catch(() => ({}));

    if (!graphRes.ok) {
      const errMsg = graphResult?.error?.message || JSON.stringify(graphResult).slice(0, 500);
      const motivo = `envio_falhou: ${errMsg}`;
      log("Meta API erro", { status: graphRes.status, body: graphResult });
      await supabase
        .from("agente_ia_mensagens")
        .update({ status_aprovacao: "recusada", motivo_recusa: motivo })
        .eq("id", mensagem_id);
      return jsonResponse({ error: "Meta API error", status: graphRes.status, detalhe: graphResult }, 500);
    }

    const wamid: string | null = graphResult?.messages?.[0]?.id || null;
    log("Meta OK", { wamid });

    // Atualiza agente_ia_mensagens
    await supabase
      .from("agente_ia_mensagens")
      .update({
        enviada_ao_cliente_em: new Date().toISOString(),
        meta_message_id: wamid,
      })
      .eq("id", mensagem_id);

    // Log no pipeline existente
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: "agente_loja_cg",
      telefone_destino: formattedPhone,
      mensagem: texto,
      status: "enviado",
      enviado_por: userId,
      payload_enviado: graphPayload,
      resposta_recebida: graphResult,
    });

    return jsonResponse({ success: true, meta_message_id: wamid });
  } catch (err: any) {
    console.error("[agente-enviar-mensagem-whatsapp] erro inesperado", err);
    return jsonResponse({ error: "Erro interno", detalhe: err?.message || String(err) }, 500);
  }
});
