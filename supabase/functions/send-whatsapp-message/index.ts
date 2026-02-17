import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
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
    const { tipo_mensagem, telefone, nome, mensagem, imagem_url, title, footer, buttonActions } = body;

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "Telefone e mensagem são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Z-API credentials from system_settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token"]);

    if (settingsError) throw settingsError;

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const instanceId = settingsMap["zapi_instance_id"];
    const zapiToken = settingsMap["zapi_token"];
    const clientToken = settingsMap["zapi_client_token"];

    if (!instanceId || !zapiToken || !clientToken) {
      // Log the attempt
      await supabase.from("whatsapp_mensagens").insert({
        tipo_mensagem: tipo_mensagem || "manual",
        telefone_destino: telefone,
        nome_destino: nome || null,
        mensagem,
        imagem_url: imagem_url || null,
        status: "erro",
        erro_detalhes: "Credenciais Z-API não configuradas",
        enviado_por: user.id,
      });

      return new Response(
        JSON.stringify({ error: "Credenciais Z-API não configuradas. Configure na aba Credenciais." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}`;

    let zapiPayload: Record<string, unknown>;
    let zapiEndpoint: string;

    if (buttonActions && buttonActions.length > 0) {
      zapiEndpoint = `${baseUrl}/send-button-actions`;
      zapiPayload = { phone: telefone, message: mensagem, title: title || "", footer: footer || "", buttonActions };
    } else if (imagem_url) {
      zapiEndpoint = `${baseUrl}/send-image`;
      zapiPayload = { phone: telefone, image: imagem_url, caption: mensagem };
    } else {
      zapiEndpoint = `${baseUrl}/send-text`;
      zapiPayload = { phone: telefone, message: mensagem };
    }

    const zapiResponse = await fetch(zapiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(zapiPayload),
    });

    const zapiResult = await zapiResponse.json();
    const isSuccess = zapiResponse.ok;

    // Log message with payload and response
    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: tipo_mensagem || "manual",
      telefone_destino: telefone,
      nome_destino: nome || null,
      mensagem,
      imagem_url: imagem_url || null,
      status: isSuccess ? "enviado" : "erro",
      erro_detalhes: isSuccess ? null : JSON.stringify(zapiResult),
      enviado_por: user.id,
      payload_enviado: zapiPayload,
      resposta_recebida: zapiResult,
    });

    if (!isSuccess) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar via Z-API", details: zapiResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: zapiResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
