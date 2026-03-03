import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function diagnosticMessage(error: Record<string, unknown>): string {
  const msg = String(error?.message || "");
  const code = Number(error?.code || 0);
  const subcode = Number(error?.error_subcode || 0);

  if (code === 100 && subcode === 33) {
    return "Permissão negada (GraphMethodException). O token não tem acesso efetivo ao ativo (WABA/Phone). Verifique se o ativo WABA está atribuído ao System User e regenere o token após a atribuição.";
  }
  if (msg.includes("Unsupported get request") || msg.includes("does not exist")) {
    return "Phone Number ID ou Business Account ID inválido, ou o token não tem permissão para acessar este recurso.";
  }
  if (msg.includes("Missing permissions") || code === 10) {
    return "O token não possui as permissões necessárias (whatsapp_business_messaging ou whatsapp_business_management).";
  }
  if (msg.includes("Template does not exist") || msg.includes("template")) {
    return "Template de mensagem não encontrado ou idioma incorreto.";
  }
  if (msg.includes("Invalid OAuth") || msg.includes("access token")) {
    return "Access Token inválido ou expirado. Gere um novo token permanente no Meta Business.";
  }
  if (code === 131030) {
    return "Número de destino não está registrado no WhatsApp ou não aceita mensagens.";
  }
  if (code === 131047) {
    return "Mensagem rejeitada: mais de 24h desde a última mensagem do contato. Use um template aprovado.";
  }
  return msg || "Erro desconhecido na API Meta.";
}

function classifyProbableCause(checks: { token_valid: boolean; waba_access: boolean; phone_access: boolean }, tokenScopes: string[]): { probable_cause: string; next_steps: string[] } {
  if (!checks.token_valid) {
    return {
      probable_cause: "Token inválido ou expirado.",
      next_steps: [
        "Acesse Meta Business Suite > Configurações > Usuários do Sistema.",
        "Selecione o System User e clique em 'Gerar novo token'.",
        "Selecione o App correto e marque as permissões: whatsapp_business_messaging e whatsapp_business_management.",
        "Copie o novo token e salve nas credenciais do painel.",
      ],
    };
  }

  const hasMessagingScope = tokenScopes.some(s => s.includes("whatsapp_business_messaging"));
  const hasManagementScope = tokenScopes.some(s => s.includes("whatsapp_business_management"));

  if (!checks.waba_access && !checks.phone_access) {
    return {
      probable_cause: "O token não tem acesso ao WABA nem ao Phone Number. O ativo WhatsApp Business Account provavelmente não está atribuído ao System User.",
      next_steps: [
        "No Meta Business Suite, vá em Configurações > Usuários do Sistema.",
        "Selecione o System User e clique em 'Atribuir ativos'.",
        "Adicione o WhatsApp Business Account (WABA) com controle total.",
        "IMPORTANTE: Após atribuir o ativo, gere um NOVO token — tokens antigos não herdam novos acessos.",
        !hasMessagingScope ? "Adicione a permissão 'whatsapp_business_messaging' ao gerar o token." : "",
        !hasManagementScope ? "Adicione a permissão 'whatsapp_business_management' ao gerar o token." : "",
      ].filter(Boolean),
    };
  }

  if (checks.waba_access && !checks.phone_access) {
    return {
      probable_cause: "O token acessa o WABA mas não o Phone Number. O Phone Number ID pode estar incorreto ou pertencer a outro WABA.",
      next_steps: [
        "Verifique no WhatsApp Manager se o Phone Number ID informado pertence ao WABA configurado.",
        "Compare o ID no painel com o exibido em Meta Business > WhatsApp > Configuração da API.",
        "Se os IDs estiverem corretos, regenere o token após confirmar a atribuição do ativo.",
      ],
    };
  }

  if (!checks.waba_access && checks.phone_access) {
    return {
      probable_cause: "O token acessa o Phone Number diretamente mas não via WABA. Pode faltar a permissão whatsapp_business_management.",
      next_steps: [
        "Adicione a permissão 'whatsapp_business_management' ao System User e regenere o token.",
        "Confirme que o WABA ID está correto no painel.",
      ],
    };
  }

  return {
    probable_cause: "Tudo OK — token, WABA e Phone Number acessíveis.",
    next_steps: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, business_account_id, phone_number_id, access_token, test_number } = body;

    if (!access_token) {
      return new Response(
        JSON.stringify({ success: false, error: "Access Token é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: test_connection (multi-stage diagnostic) ============
    if (action === "test_connection") {
      const checks = { token_valid: false, waba_access: false, phone_access: false };
      const raw: Record<string, unknown> = {};
      let tokenScopes: string[] = [];

      // --- Stage A: validate token via /me ---
      try {
        const meRes = await fetch("https://graph.facebook.com/v22.0/me?fields=id,name", {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const meData = await meRes.json();
        raw.token_check = { status: meRes.status, data: meData };
        console.log("[diagnostic] /me status:", meRes.status, JSON.stringify(meData));

        if (meRes.ok && meData?.id) {
          checks.token_valid = true;

          // Try to get token scopes via debug_token (best effort)
          try {
            const debugRes = await fetch(`https://graph.facebook.com/v22.0/debug_token?input_token=${access_token}`, {
              headers: { Authorization: `Bearer ${access_token}` },
            });
            const debugData = await debugRes.json();
            raw.token_debug = debugData;
            if (debugData?.data?.scopes) {
              tokenScopes = debugData.data.scopes;
            }
          } catch (_) { /* best effort */ }
        }
      } catch (e) {
        raw.token_check = { error: String(e) };
      }

      // --- Stage B1: test WABA access ---
      if (business_account_id) {
        try {
          const wabaRes = await fetch(`https://graph.facebook.com/v22.0/${business_account_id}?fields=id,name,message_template_namespace`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          const wabaData = await wabaRes.json();
          raw.waba_check = { status: wabaRes.status, data: wabaData };
          console.log("[diagnostic] WABA status:", wabaRes.status, JSON.stringify(wabaData));

          if (wabaRes.ok && wabaData?.id) {
            checks.waba_access = true;
          }
        } catch (e) {
          raw.waba_check = { error: String(e) };
        }
      }

      // --- Stage B2: test Phone Number access ---
      if (phone_number_id) {
        try {
          const phoneRes = await fetch(`https://graph.facebook.com/v22.0/${phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });
          const phoneData = await phoneRes.json();
          raw.phone_check = { status: phoneRes.status, data: phoneData };
          console.log("[diagnostic] Phone status:", phoneRes.status, JSON.stringify(phoneData));

          if (phoneRes.ok && phoneData?.display_phone_number) {
            checks.phone_access = true;
          }
        } catch (e) {
          raw.phone_check = { error: String(e) };
        }
      }

      // --- Stage C: classify probable cause ---
      const { probable_cause, next_steps } = classifyProbableCause(checks, tokenScopes);

      const allOk = checks.token_valid && checks.waba_access && checks.phone_access;

      // Build phone_numbers array for backward compat
      let phone_numbers: any[] | undefined;
      if (checks.phone_access && raw.phone_check) {
        const pd = (raw.phone_check as any)?.data;
        if (pd?.display_phone_number) {
          phone_numbers = [{
            id: phone_number_id,
            display_phone_number: pd.display_phone_number,
            verified_name: pd.verified_name || "N/A",
            quality_rating: pd.quality_rating || "N/A",
          }];
        }
      }

      return new Response(
        JSON.stringify({
          success: allOk,
          checks,
          token_scopes: tokenScopes,
          probable_cause,
          next_steps,
          phone_numbers,
          raw_diagnostics: raw,
          error: allOk ? undefined : probable_cause,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============ ACTION: test_send ============
    if (action === "test_send") {
      if (!phone_number_id) {
        return new Response(
          JSON.stringify({ success: false, error: "Phone Number ID é obrigatório para envio de teste" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!test_number) {
        return new Response(
          JSON.stringify({ success: false, error: "Número de teste é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let cleaned = test_number.replace(/\D/g, "");
      if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
      if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;

      const endpoint = `https://graph.facebook.com/v22.0/${phone_number_id}/messages`;
      const payload = {
        messaging_product: "whatsapp",
        to: cleaned,
        type: "text",
        text: { body: "Teste de integração WhatsApp Cloud API 🚀" },
      };

      console.log("[test_send] POST", endpoint, JSON.stringify(payload));

      const sendRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${access_token}`,
        },
        body: JSON.stringify(payload),
      });

      const sendData = await sendRes.json();
      console.log("[test_send] status:", sendRes.status, "body:", JSON.stringify(sendData));

      if (!sendRes.ok) {
        const metaError = sendData?.error || {};
        return new Response(
          JSON.stringify({
            success: false,
            error: diagnosticMessage(metaError),
            details: metaError,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: sendData }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Action inválida. Use 'test_connection' ou 'test_send'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[whatsapp-meta-test] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
