import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { whatsapp } = await req.json();

    // Limpar número: só dígitos, sem 55 inicial
    const digitsOnly = String(whatsapp || "").replace(/\D/g, "");
    const numeroLimpo =
      digitsOnly.startsWith("55") && digitsOnly.length >= 12
        ? digitsOnly.slice(2)
        : digitsOnly;

    if (!numeroLimpo || numeroLimpo.length < 10) {
      return new Response(
        JSON.stringify({ erro: "numero_invalido" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar se número tem licença ativa
    const { data: licenca } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select("id, nome_comprador, email")
      .eq("whatsapp", numeroLimpo)
      .eq("ativo", true)
      .maybeSingle();

    if (!licenca) {
      return new Response(
        JSON.stringify({ erro: "numero_nao_encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Gerar código de 4 dígitos
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Salvar OTP
    await supabaseAdmin.from("revista_otp").insert({
      whatsapp: numeroLimpo,
      codigo,
      expira_em: expiraEm,
    });

    // ── Buscar credenciais WhatsApp da Meta ──
    const settingsRes = await supabaseAdmin
      .from("system_settings")
      .select("key, value")
      .in("key", ["whatsapp_phone_number_id", "whatsapp_access_token"]);

    const settings = Object.fromEntries(
      (settingsRes.data || []).map((s: any) => [s.key, s.value])
    );

    const phoneNumberId = settings["whatsapp_phone_number_id"];
    const accessToken = settings["whatsapp_access_token"];

    if (!phoneNumberId || !accessToken) {
      console.error("WhatsApp credentials missing in system_settings");
      return new Response(
        JSON.stringify({ erro: "config_whatsapp_ausente" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Formatar número para a Meta: adicionar 55 se não tiver
    const digits = numeroLimpo.replace(/\D/g, "");
    const metaPhone = digits.startsWith("55") ? digits : `55${digits}`;

    // ── Enviar WhatsApp diretamente via API da Meta ──
    const waRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: metaPhone,
          type: "text",
          text: {
            body: `Seu codigo de acesso a revista e:\n\n*${codigo}*\n\nDigite este codigo na tela.\nEle expira em 10 minutos.\n\nNao compartilhe este codigo.`,
          },
        }),
      }
    );

    const waData = await waRes.json();

    if (!waRes.ok) {
      console.error("WhatsApp send error:", JSON.stringify(waData));
      return new Response(
        JSON.stringify({ erro: "falha_whatsapp", detalhe: waData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Fallback: enviar código também por email (se disponível) ──
    if (licenca.email) {
      try {
        await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-ebd-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              to: licenca.email,
              subject: "Seu codigo de acesso a revista",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="color:#1B3A5C">Ola, ${licenca.nome_comprador || "leitor"}!</h2>
                  <p style="font-size:16px">Seu codigo de acesso a revista e:</p>
                  <div style="font-size:48px;font-weight:bold;text-align:center;
                              letter-spacing:12px;color:#1B3A5C;padding:24px 0">
                    ${codigo}
                  </div>
                  <p style="font-size:14px;color:#666">
                    Este codigo expira em 10 minutos.<br>
                    Nao compartilhe este codigo.
                  </p>
                </div>
              `,
            }),
          }
        );
      } catch (emailErr) {
        console.error("Email fallback error:", emailErr);
        // Não bloqueia — WhatsApp já foi enviado com sucesso
      }
    }

    return new Response(
      JSON.stringify({ sucesso: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("revista-solicitar-otp error:", error);
    return new Response(
      JSON.stringify({
        erro: "erro_interno",
        detalhe: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
