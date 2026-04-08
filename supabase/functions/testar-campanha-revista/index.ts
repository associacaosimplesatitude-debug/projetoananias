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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
    const rawNumero = (body.numero || "").replace(/\D/g, "");

    if (!rawNumero || rawNumero.length < 10) {
      return new Response(JSON.stringify({ error: "Número inválido. Informe DDD + número." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone
    let phone = rawNumero;
    if (phone.startsWith("0")) phone = phone.slice(1);
    if (!phone.startsWith("55")) phone = "55" + phone;

    // Lookup name in revista_licencas_shopify
    const { data: licenca } = await supabase
      .from("revista_licencas_shopify")
      .select("nome_comprador")
      .eq("whatsapp", rawNumero)
      .limit(1)
      .maybeSingle();

    const nomeCompleto = licenca?.nome_comprador || "Teste";
    const primeiroNome = nomeCompleto.split(" ")[0];

    // Fetch WhatsApp credentials
    const { data: settings } = await supabase
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

    const settingsMap: Record<string, string> = {};
    (settings || []).forEach((s: { key: string; value: string }) => {
      settingsMap[s.key] = s.value;
    });

    const phoneNumberId = settingsMap["whatsapp_phone_number_id"];
    const accessToken = settingsMap["whatsapp_access_token"];

    if (!phoneNumberId || !accessToken) {
      return new Response(JSON.stringify({ error: "Credenciais WhatsApp não configuradas em Integrações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Meta API payload
    const linkEscolha = `https://gestaoebd.com.br/escolha?w=${rawNumero}`;

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: "utilidade",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: primeiroNome },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: linkEscolha },
            ],
          },
        ],
      },
    };

    console.log("[testar-campanha-revista] Enviando para", phone, "nome:", primeiroNome);

    const res = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const resBody = await res.json();

    if (!res.ok) {
      const errorMsg = resBody?.error?.message || JSON.stringify(resBody);
      console.error("[testar-campanha-revista] Erro Meta:", errorMsg);
      return new Response(
        JSON.stringify({ error: `Erro Meta API: ${errorMsg}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ sucesso: true, nome: primeiroNome, telefone: phone }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[testar-campanha-revista] Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
