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

  if (msg.includes("Unsupported get request") || msg.includes("does not exist")) {
    return "Phone Number ID ou Business Account ID inválido, ou o token não tem permissão para acessar este recurso.";
  }
  if (msg.includes("Missing permissions") || code === 10 || subcode === 33) {
    return "O token não possui as permissões necessárias (whatsapp_business_messaging ou whatsapp_business_management). Verifique as permissões do System User no Meta Business.";
  }
  if (msg.includes("Template does not exist") || msg.includes("template")) {
    return "Template de mensagem não encontrado ou idioma incorreto. Verifique os templates aprovados no Meta Business.";
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

    // ============ ACTION: test_connection ============
    if (action === "test_connection") {
      if (!business_account_id) {
        return new Response(
          JSON.stringify({ success: false, error: "WhatsApp Business Account ID é obrigatório para testar conexão" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const endpoint = `https://graph.facebook.com/v22.0/${business_account_id}/phone_numbers?fields=id,display_phone_number,verified_name`;
      console.log("[test_connection] GET", endpoint);

      const listRes = await fetch(endpoint, {
        method: "GET",
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const listData = await listRes.json();
      console.log("[test_connection] status:", listRes.status, "body:", JSON.stringify(listData));

      if (!listRes.ok || !Array.isArray(listData?.data)) {
        const metaError = listData?.error || {};
        return new Response(
          JSON.stringify({
            success: false,
            error: diagnosticMessage(metaError),
            details: metaError,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Fetch details for each phone number (quality_rating)
      const phoneNumbers = [];
      for (const phone of listData.data) {
        const detailEndpoint = `https://graph.facebook.com/v22.0/${phone.id}?fields=display_phone_number,verified_name,quality_rating`;
        console.log("[test_connection] GET detail", detailEndpoint);
        const detailRes = await fetch(detailEndpoint, {
          method: "GET",
          headers: { Authorization: `Bearer ${access_token}` },
        });
        const detailData = await detailRes.json();
        console.log("[test_connection] detail status:", detailRes.status, "body:", JSON.stringify(detailData));

        if (detailRes.ok && detailData?.display_phone_number) {
          phoneNumbers.push({
            id: phone.id,
            display_phone_number: detailData.display_phone_number,
            verified_name: detailData.verified_name || "N/A",
            quality_rating: detailData.quality_rating || "N/A",
          });
        } else {
          phoneNumbers.push({
            id: phone.id,
            display_phone_number: phone.display_phone_number || "N/A",
            verified_name: phone.verified_name || "N/A",
            quality_rating: "N/A",
          });
        }
      }

      return new Response(
        JSON.stringify({ success: true, phone_numbers: phoneNumbers }),
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

      // Format phone number
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
