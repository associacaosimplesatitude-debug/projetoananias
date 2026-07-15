// Proxy de teste para o agente-loja-cg.
// Só superadmin pode chamar. Repassa a mensagem para agente-loja-cg
// usando service role, e NÃO envia nada pelo WhatsApp (garantido pelo
// system_settings.agente_modo_loja_cg = 'supervisionado').

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TELEFONE_DEFAULT = "11947141878";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "").trim();
    if (!token) return json({ error: "Não autorizado" }, 401);

    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData?.user) return json({ error: "Não autorizado" }, 401);

    const { data: hasRole, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "superadmin",
    });
    if (roleErr || hasRole !== true) return json({ error: "Permissão negada" }, 403);

    const body = await req.json().catch(() => ({}));
    const telefone: string = (body?.telefone || TELEFONE_DEFAULT).toString().replace(/\D/g, "");
    const acao: string | undefined = body?.acao;

    if (acao === "reiniciar") {
      const { error } = await supabase
        .from("agente_ia_conversas")
        .update({ status: "encerrada" })
        .eq("telefone", telefone)
        .eq("status", "ativa");
      if (error) return json({ error: error.message }, 500);
      return json({ success: true, telefone });
    }

    const mensagem_user: string = (body?.mensagem_user || "").toString();
    if (!mensagem_user.trim()) {
      return json({ error: "mensagem_user é obrigatório" }, 400);
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/agente-loja-cg`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
      },
      body: JSON.stringify({ telefone, mensagem_user }),
    });

    const text = await resp.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    return json(data, resp.status);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
