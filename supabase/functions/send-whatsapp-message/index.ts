import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith("55")) cleaned = "55" + cleaned;
  return cleaned;
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
    const { tipo_mensagem, telefone, nome, mensagem, imagem_url } = body;

    if (!telefone || !mensagem) {
      return new Response(JSON.stringify({ error: "Telefone e mensagem são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch Meta WhatsApp credentials from system_settings
    const { data: settings, error: settingsError } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_business_account_id", "whatsapp_access_token"]);

    if (settingsError) throw settingsError;

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const configuredPhoneNumberId = settingsMap["whatsapp_phone_number_id"];
    const businessAccountId = settingsMap["whatsapp_business_account_id"];
    const accessToken = settingsMap["whatsapp_access_token"];

    if (!accessToken) {
      await supabase.from("whatsapp_mensagens").insert({
        tipo_mensagem: tipo_mensagem || "manual",
        telefone_destino: telefone,
        nome_destino: nome || null,
        mensagem,
        imagem_url: imagem_url || null,
        status: "erro",
        erro_detalhes: "Access Token da API Oficial do WhatsApp (Meta) não configurado",
        enviado_por: user.id,
      });

      return new Response(
        JSON.stringify({ error: "Access Token da API Oficial do WhatsApp não configurado. Configure na aba Integrações." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const getPhoneNumbersFromBusiness = async (wabaId: string) => {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();
      const phoneNumbers = Array.isArray(result?.data) ? result.data : [];
      return { ok: response.ok, result, phoneNumbers };
    };

    const validatePhoneNumberId = async (id: string) => {
      const response = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=id,display_phone_number,verified_name`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();
      const hasWhatsappPhoneShape = Boolean(result?.display_phone_number);
      return { ok: response.ok && hasWhatsappPhoneShape, result };
    };

    let phoneNumberId = configuredPhoneNumberId;

    if (businessAccountId) {
      const fromBusiness = await getPhoneNumbersFromBusiness(businessAccountId);

      if (fromBusiness.ok && fromBusiness.phoneNumbers.length > 0) {
        const availableIds = fromBusiness.phoneNumbers.map((p) => String((p as { id: string }).id));

        if (!phoneNumberId || !availableIds.includes(phoneNumberId)) {
          phoneNumberId = availableIds[0];
          await supabase
            .from("system_settings")
            .upsert({ key: "whatsapp_phone_number_id", value: phoneNumberId }, { onConflict: "key" });
        }
      }
    }

    if (phoneNumberId) {
      const validation = await validatePhoneNumberId(phoneNumberId);
      if (!validation.ok) {
        phoneNumberId = "";
      }
    }

    if (!phoneNumberId) {
      await supabase.from("whatsapp_mensagens").insert({
        tipo_mensagem: tipo_mensagem || "manual",
        telefone_destino: telefone,
        nome_destino: nome || null,
        mensagem,
        imagem_url: imagem_url || null,
        status: "erro",
        erro_detalhes: "Phone Number ID inválido/ausente e não foi possível resolver via Business Account ID",
        enviado_por: user.id,
      });

      return new Response(
        JSON.stringify({
          error:
            "Phone Number ID inválido/ausente. Configure um Phone Number ID válido na aba Integrações ou informe também o WhatsApp Business Account ID para resolução automática.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhone(telefone);
    const graphUrl = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

    let graphPayload: Record<string, unknown>;

    if (imagem_url) {
      graphPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "image",
        image: { link: imagem_url, caption: mensagem },
      };
    } else {
      graphPayload = {
        messaging_product: "whatsapp",
        to: formattedPhone,
        type: "text",
        text: { body: mensagem },
      };
    }

    const graphResponse = await fetch(graphUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(graphPayload),
    });

    const graphResult = await graphResponse.json();
    const isSuccess = graphResponse.ok;

    await supabase.from("whatsapp_mensagens").insert({
      tipo_mensagem: tipo_mensagem || "manual",
      telefone_destino: telefone,
      nome_destino: nome || null,
      mensagem,
      imagem_url: imagem_url || null,
      status: isSuccess ? "enviado" : "erro",
      erro_detalhes: isSuccess ? null : JSON.stringify(graphResult),
      enviado_por: user.id,
      payload_enviado: graphPayload,
      resposta_recebida: graphResult,
    });

    if (!isSuccess) {
      return new Response(
        JSON.stringify({ error: "Erro ao enviar via API Meta", details: graphResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: graphResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
