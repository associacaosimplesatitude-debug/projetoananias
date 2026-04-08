import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sua revista digital ganhou algo novo</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background-color:#1a1a2e;padding:28px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">
              Central Gospel — Revista Digital
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 16px;color:#1a1a2e;font-size:22px;font-weight:700;">
              Olá, {nome}!
            </h2>
            <p style="margin:0 0 20px;color:#4a4a68;font-size:16px;line-height:1.6;">
              Sua revista digital ganhou algo novo — e você precisa ver isso.
            </p>
            <p style="margin:0 0 32px;color:#4a4a68;font-size:16px;line-height:1.6;">
              Agora você escolhe como quer ler. Cada opção foi pensada para um jeito diferente de estudar a Palavra.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;background-color:#f0f4ff;border-radius:10px;padding:20px;">
              <tr><td style="padding:20px;">
                <h3 style="margin:0 0 6px;color:#1a1a2e;font-size:16px;font-weight:700;">
                  CG Digital — Versão completa
                </h3>
                <p style="margin:0;color:#4a4a68;font-size:14px;line-height:1.5;">
                  Quiz, pontos, ranking, referências bíblicas, anotações e muito mais.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;background-color:#f0fdf4;border-radius:10px;padding:20px;">
              <tr><td style="padding:20px;">
                <h3 style="margin:0 0 6px;color:#1a1a2e;font-size:16px;font-weight:700;">
                  Leitor CG — Versão offline
                </h3>
                <p style="margin:0;color:#4a4a68;font-size:14px;line-height:1.5;">
                  Baixa a revista no celular. Leia em qualquer lugar, mesmo sem internet.
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td align="center">
                <a href="{link_escolha}" style="display:inline-block;background-color:#6c3cff;color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;">
                  Escolher minha versão
                </a>
              </td></tr>
            </table>
            <p style="margin:32px 0 0;color:#9ca3af;font-size:13px;line-height:1.5;text-align:center;">
              Você pode mudar sua preferência a qualquer momento.<br>
              Central Gospel — Sua revista, do seu jeito.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { dry_run, test_email } = await req.json();

    // Fetch unique recipients
    let query = supabase
      .from("revista_licencas_shopify")
      .select("email, nome_comprador, whatsapp")
      .eq("ativo", true)
      .not("email", "is", null)
      .neq("email", "");

    // If test_email is provided, filter to only that email
    if (test_email) {
      query = query.eq("email", test_email);
    }

    const { data: recipients, error: fetchError } = await query
      .order("email")
      .order("created_at", { ascending: false });

    if (fetchError) throw new Error(`Error fetching recipients: ${fetchError.message}`);

    // Deduplicate by email (keep first occurrence = most recent due to order)
    const seen = new Set<string>();
    const uniqueRecipients = (recipients || []).filter((r) => {
      const email = r.email!.toLowerCase().trim();
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    const total = uniqueRecipients.length;

    if (dry_run) {
      return new Response(
        JSON.stringify({ total, dry_run: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send emails
    let enviados = 0;
    let erros = 0;

    for (const recipient of uniqueRecipients) {
      const email = recipient.email!.trim();
      const nomeCompleto = recipient.nome_comprador || "Leitor(a)";
      const primeiroNome = nomeCompleto.split(" ")[0];
      const whatsapp = recipient.whatsapp || "";
      const linkEscolha = `https://gestaoebd.com.br/escolha${whatsapp ? `?w=${encodeURIComponent(whatsapp)}` : ""}`;

      const html = EMAIL_TEMPLATE
        .replace(/{nome}/g, primeiroNome)
        .replace(/{link_escolha}/g, linkEscolha);

      let status = "enviado";
      let erroMsg: string | null = null;

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Central Gospel <noreply@painel.editoracentralgospel.com.br>",
            to: [email],
            subject: "Sua revista digital ganhou algo novo",
            html,
          }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend ${res.status}: ${body}`);
        }

        enviados++;
      } catch (e: any) {
        status = "erro";
        erroMsg = e.message;
        erros++;
        console.error(`Error sending to ${email}:`, e.message);
      }

      // Log to ebd_email_logs
      await supabase.from("ebd_email_logs").insert({
        destinatario: email,
        assunto: "Sua revista digital ganhou algo novo",
        status,
        erro: erroMsg,
        tipo_envio: "campanha_escolha_versao",
        dados_enviados: { nome: primeiroNome, whatsapp, link_escolha: linkEscolha },
      });

      // Rate limit delay
      await sleep(150);
    }

    console.log(`enviar-campanha-revista: Done. Sent: ${enviados}, Errors: ${erros}`);

    return new Response(
      JSON.stringify({ total, enviados, erros, dry_run: false }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("enviar-campanha-revista: Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
