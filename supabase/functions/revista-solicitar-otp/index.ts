import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
    const { data } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select(`
        id, nome_comprador, email, primeiro_acesso_em, ultimo_acesso_em,
        revista_id,
        revistas_digitais (
          id, titulo, capa_url, total_licoes, tipo, pdf_url, leitura_continua, tipo_conteudo
        )
      `)
      .eq("whatsapp", numeroLimpo)
      .eq("ativo", true);

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ erro: "numero_nao_encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se pode ter acesso direto (sem OTP)
    // Condição: primeiro_acesso_em preenchido E ultimo_acesso_em dentro de 30 dias
    const primeiraLicenca = data[0];
    const temPrimeiroAcesso = !!primeiraLicenca.primeiro_acesso_em;
    const ultimoAcesso = primeiraLicenca.ultimo_acesso_em
      ? new Date(primeiraLicenca.ultimo_acesso_em).getTime()
      : null;
    const dentroDosPrazoDias =
      ultimoAcesso !== null && (Date.now() - ultimoAcesso) < THIRTY_DAYS_MS;

    if (temPrimeiroAcesso && dentroDosPrazoDias) {
      // ACESSO DIRETO — sem OTP
      // Atualizar ultimo_acesso_em
      await supabaseAdmin
        .from("revista_licencas_shopify")
        .update({ ultimo_acesso_em: new Date().toISOString() })
        .eq("whatsapp", numeroLimpo)
        .eq("ativo", true);

      // Gerar token
      const token = btoa(
        JSON.stringify({
          whatsapp: numeroLimpo,
          exp: Date.now() + 86400000,
          licencas: data.map((l: any) => l.revista_id),
        })
      );

      return new Response(
        JSON.stringify({
          status: "acesso_direto",
          token,
          licencas: data,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // PRECISA DE OTP — primeira vez ou prazo expirado
    const motivo = temPrimeiroAcesso ? "prazo_expirado" : "primeiro_acesso";
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

    // ── Enviar WhatsApp via template AUTHENTICATION da Meta ──
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
          type: "template",
          template: {
            name: "acesso_revista_otp",
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: codigo }
                ]
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: codigo }
                ]
              }
            ]
          }
        }),
      }
    );

    const waData = await waRes.json();
    console.log("Meta WA response status:", waRes.status);
    console.log("Meta WA response body:", JSON.stringify(waData));

    if (!waRes.ok) {
      console.error("WhatsApp send error:", JSON.stringify(waData));
      return new Response(
        JSON.stringify({ erro: "falha_whatsapp", status: waRes.status, detalhe: waData }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Fallback: enviar código também por email via Resend (se disponível) ──
    const licencaComEmail = data.find((l: any) => l.email);
    if (licencaComEmail?.email) {
      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (resendApiKey) {
          const emailRes = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Gestão EBD <relatorios@painel.editoracentralgospel.com.br>",
              to: [licencaComEmail.email],
              subject: "Seu código de acesso à revista",
              html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h2 style="color:#1B3A5C">Olá, ${primeiraLicenca.nome_comprador || "leitor"}!</h2>
                  <p style="font-size:16px">Seu código de acesso à revista é:</p>
                  <div style="font-size:48px;font-weight:bold;text-align:center;
                              letter-spacing:12px;color:#1B3A5C;padding:24px 0">
                    ${codigo}
                  </div>
                  <p style="font-size:14px;color:#666">
                    Este código expira em 10 minutos.<br>
                    Não compartilhe este código.
                  </p>
                </div>
              `,
            }),
          });
          const emailData = await emailRes.json();
          if (!emailRes.ok) {
            console.error("Resend email error:", JSON.stringify(emailData));
          } else {
            console.log("OTP email sent to:", licencaComEmail.email);
          }
        } else {
          console.warn("RESEND_API_KEY not configured, skipping email fallback");
        }
      } catch (emailErr) {
        console.error("Email fallback error:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({ status: "otp_enviado", motivo, sucesso: true }),
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
