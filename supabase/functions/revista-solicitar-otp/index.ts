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
    const body = await req.json();
    const { whatsapp, email } = body;

    // Determine lookup mode: email or phone
    const isEmailMode = !!email && !whatsapp;
    let identificador: string;

    if (isEmailMode) {
      identificador = String(email).trim().toLowerCase();
      if (!identificador || !identificador.includes("@")) {
        return new Response(
          JSON.stringify({ erro: "numero_invalido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Phone mode (original logic)
      const digitsOnly = String(whatsapp || "").replace(/\D/g, "");
      identificador =
        digitsOnly.startsWith("55") && digitsOnly.length >= 12
          ? digitsOnly.slice(2)
          : digitsOnly;

      if (!identificador || identificador.length < 10) {
        return new Response(
          JSON.stringify({ erro: "numero_invalido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar licenças ativas pelo identificador (whatsapp field pode conter email ou telefone)
    const { data } = await supabaseAdmin
      .from("revista_licencas_shopify")
      .select(`
        id, nome_comprador, email, primeiro_acesso_em, ultimo_acesso_em,
        revista_id, versao_preferida,
        revistas_digitais (
          id, titulo, capa_url, total_licoes, tipo, pdf_url, leitura_continua, tipo_conteudo
        )
      `)
      .eq("whatsapp", identificador)
      .eq("ativo", true);

    // If email mode and no results by whatsapp field, also try by email field
    let licencas = data;
    let lookupField = "whatsapp";
    if (isEmailMode && (!licencas || licencas.length === 0)) {
      const { data: emailData } = await supabaseAdmin
        .from("revista_licencas_shopify")
        .select(`
          id, nome_comprador, email, primeiro_acesso_em, ultimo_acesso_em,
          revista_id, versao_preferida,
          revistas_digitais (
            id, titulo, capa_url, total_licoes, tipo, pdf_url, leitura_continua, tipo_conteudo
          )
        `)
        .eq("email", identificador)
        .eq("ativo", true);
      
      if (emailData && emailData.length > 0) {
        licencas = emailData;
        // Use the whatsapp value from the first license for OTP storage
        identificador = emailData[0].whatsapp || identificador;
        lookupField = "email";
      }
    }

    if (!licencas || licencas.length === 0) {
      return new Response(
        JSON.stringify({ erro: "numero_nao_encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se pode ter acesso direto (sem OTP)
    const primeiraLicenca = licencas[0];
    const temPrimeiroAcesso = !!primeiraLicenca.primeiro_acesso_em;
    const ultimoAcesso = primeiraLicenca.ultimo_acesso_em
      ? new Date(primeiraLicenca.ultimo_acesso_em).getTime()
      : null;
    const dentroDosPrazoDias =
      ultimoAcesso !== null && (Date.now() - ultimoAcesso) < THIRTY_DAYS_MS;

    if (temPrimeiroAcesso && dentroDosPrazoDias) {
      // ACESSO DIRETO — sem OTP
      await supabaseAdmin
        .from("revista_licencas_shopify")
        .update({ ultimo_acesso_em: new Date().toISOString() })
        .eq("whatsapp", identificador)
        .eq("ativo", true);

      const token = btoa(
        JSON.stringify({
          whatsapp: identificador,
          exp: Date.now() + 86400000,
          licencas: licencas.map((l: any) => l.revista_id),
        })
      );

      const versaoPreferida = licencas[0]?.versao_preferida || "cg_digital";

      return new Response(
        JSON.stringify({
          status: "acesso_direto",
          token,
          licencas,
          versao_preferida: versaoPreferida,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PRECISA DE OTP — primeira vez ou prazo expirado
    const motivo = temPrimeiroAcesso ? "prazo_expirado" : "primeiro_acesso";
    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Salvar OTP usando o identificador
    await supabaseAdmin.from("revista_otp").insert({
      whatsapp: identificador,
      codigo,
      expira_em: expiraEm,
    });

    // Determine if we should send via WhatsApp or email-only
    const identificadorIsEmail = identificador.includes("@");
    let otpVia = "whatsapp";

    if (!identificadorIsEmail) {
      // Phone-based: send WhatsApp OTP (original flow)
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
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const digits = identificador.replace(/\D/g, "");
      // Brazilian numbers (10-11 digits, no DDI prefix) need 55 prepended.
      // International numbers already include their DDI (e.g. 351... for Portugal).
      const isBrazilian = digits.length <= 11;
      const metaPhone = isBrazilian ? `55${digits}` : digits;

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
                  parameters: [{ type: "text", text: codigo }],
                },
                {
                  type: "button",
                  sub_type: "url",
                  index: "0",
                  parameters: [{ type: "text", text: codigo }],
                },
              ],
            },
          }),
        }
      );

      const waData = await waRes.json();
      console.log("Meta WA response status:", waRes.status);
      console.log("Meta WA response body:", JSON.stringify(waData));

      const waLogStatus = waRes.ok ? "enviado" : "erro";
      try {
        await supabaseAdmin.from("whatsapp_mensagens").insert({
          tipo_mensagem: "revista_otp",
          telefone_destino: metaPhone,
          nome_destino: primeiraLicenca.nome_comprador || null,
          mensagem: "Código OTP enviado (template acesso_revista_otp)",
          status: waLogStatus,
          erro_detalhes: waRes.ok ? null : JSON.stringify(waData),
          payload_enviado: JSON.stringify({
            messaging_product: "whatsapp",
            to: metaPhone,
            type: "template",
            template: { name: "acesso_revista_otp", language: { code: "pt_BR" } },
          }),
          resposta_recebida: JSON.stringify(waData),
        });
      } catch (logErr) {
        console.error("Erro ao registrar log WhatsApp OTP:", logErr);
      }

      if (!waRes.ok) {
        console.error("WhatsApp send error:", JSON.stringify(waData));
        return new Response(
          JSON.stringify({ erro: "falha_whatsapp", status: waRes.status, detalhe: waData }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Also send email fallback for phone users
      const licencaComEmail = licencas.find((l: any) => l.email);
      if (licencaComEmail?.email) {
        try {
          const resendApiKey = Deno.env.get("RESEND_API_KEY");
          if (resendApiKey) {
            await fetch("https://api.resend.com/emails", {
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
          }
        } catch (emailErr) {
          console.error("Email fallback error:", emailErr);
        }
      }

      otpVia = "whatsapp";
    } else {
      // Email-based: send OTP only by email (no WhatsApp)
      otpVia = "email";
      const emailDestinatario = isEmailMode ? email : primeiraLicenca.email || identificador;

      try {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) {
          console.error("RESEND_API_KEY not configured");
          return new Response(
            JSON.stringify({ erro: "config_email_ausente" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Gestão EBD <relatorios@painel.editoracentralgospel.com.br>",
            to: [emailDestinatario],
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
        console.log("Email OTP response:", emailRes.status, JSON.stringify(emailData));

        if (!emailRes.ok) {
          console.error("Email OTP send error:", JSON.stringify(emailData));
          return new Response(
            JSON.stringify({ erro: "falha_email", status: emailRes.status }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (emailErr) {
        console.error("Email OTP error:", emailErr);
        return new Response(
          JSON.stringify({ erro: "falha_email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ status: "otp_enviado", motivo, sucesso: true, otp_via: otpVia }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("revista-solicitar-otp error:", error);
    return new Response(
      JSON.stringify({
        erro: "erro_interno",
        detalhe: error.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
