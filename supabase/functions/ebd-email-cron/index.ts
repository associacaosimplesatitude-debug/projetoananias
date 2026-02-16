import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const handler = async (req: Request): Promise<Response> => {
  console.log("ebd-email-cron: Starting daily email processing");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Helper: format date for display
    const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");

    // Helper: check if email already sent for this cliente+template today
    const alreadySent = async (clienteId: string, templateCode: string): Promise<boolean> => {
      const startOfDay = `${todayStr}T00:00:00.000Z`;
      const endOfDay = `${todayStr}T23:59:59.999Z`;
      const { data } = await supabase
        .from("ebd_email_logs")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("status", "enviado")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .limit(1);

      // Also check by template code via join
      if (data && data.length > 0) {
        // Check if any log today matches the template
        const { data: logs } = await supabase
          .from("ebd_email_logs")
          .select("id, template:ebd_email_templates!inner(codigo)")
          .eq("cliente_id", clienteId)
          .eq("ebd_email_templates.codigo", templateCode)
          .eq("status", "enviado")
          .gte("created_at", startOfDay)
          .lte("created_at", endOfDay)
          .limit(1);
        return (logs && logs.length > 0) || false;
      }
      return false;
    };

    // Helper: send email for a cliente using a template
    const sendEmail = async (
      cliente: any,
      templateCode: string,
      extraVars: Record<string, string> = {}
    ) => {
      // Check dedup
      if (await alreadySent(cliente.id, templateCode)) {
        console.log(`ebd-email-cron: Skipping ${templateCode} for ${cliente.id} (already sent today)`);
        return;
      }

      // Fetch template
      const { data: template } = await supabase
        .from("ebd_email_templates")
        .select("*")
        .eq("codigo", templateCode)
        .eq("is_active", true)
        .single();

      if (!template) {
        console.log(`ebd-email-cron: Template ${templateCode} not found or inactive`);
        return;
      }

      // Get email
      const destinatario = cliente.email_superintendente;
      if (!destinatario) {
        console.log(`ebd-email-cron: No email for cliente ${cliente.id}`);
        return;
      }

      // Get vendedor
      let vendedorNome = "Equipe Central Gospel";
      if (cliente.vendedor_id) {
        const { data: v } = await supabase
          .from("vendedores")
          .select("nome")
          .eq("id", cliente.vendedor_id)
          .single();
        if (v) vendedorNome = v.nome;
      }

      // Build variables
      const variables: Record<string, string> = {
        nome: cliente.nome_responsavel || cliente.nome_igreja,
        nome_igreja: cliente.nome_igreja,
        vendedor_nome: vendedorNome,
        link_painel: "https://gestaoebd.com.br/login/ebd",
        link_catalogo: "https://gestaoebd.com.br/vendedor/catalogo",
        data_proxima_compra: cliente.data_proxima_compra
          ? formatDate(cliente.data_proxima_compra)
          : "N/A",
        ...extraVars,
      };

      // Replace
      let assunto = template.assunto;
      let corpo = template.corpo_html;
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{${key}\\}`, "g");
        assunto = assunto.replace(regex, value || "");
        corpo = corpo.replace(regex, value || "");
      }

      // Send with tracking
      try {
        // Insert log FIRST to get logId
        const { data: logRow, error: logError } = await supabase.from("ebd_email_logs").insert({
          template_id: template.id,
          cliente_id: cliente.id,
          vendedor_id: cliente.vendedor_id || null,
          destinatario,
          assunto,
          status: "enviado",
          dados_enviados: variables,
          tipo_envio: "cron",
        }).select("id").single();

        if (logError) {
          console.error(`ebd-email-cron: Error creating log for ${templateCode}:`, logError);
          return;
        }

        const logId = logRow.id;
        const trackerBaseUrl = `${supabaseUrl}/functions/v1/ebd-email-tracker`;

        // Rewrite links for click tracking
        corpo = corpo.replace(/<a\s+([^>]*?)href="([^"]*)"([^>]*)>/gi, (_match: string, before: string, href: string, after: string) => {
          if (href.startsWith("mailto:") || href.startsWith("tel:")) {
            return `<a ${before}href="${href}"${after}>`;
          }
          const trackedUrl = `${trackerBaseUrl}?type=click&logId=${logId}&url=${encodeURIComponent(href)}`;
          return `<a ${before}href="${trackedUrl}"${after}>`;
        });

        // Add tracking pixel
        const trackingPixel = `<img src="${trackerBaseUrl}?type=open&logId=${logId}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`;
        if (corpo.includes("</body>")) {
          corpo = corpo.replace("</body>", `${trackingPixel}</body>`);
        } else {
          corpo += trackingPixel;
        }

        const emailResponse = await resend.emails.send({
          from: "Relatorios <relatorios@painel.editoracentralgospel.com.br>",
          to: [destinatario],
          subject: assunto,
          html: corpo,
        });

        // Update log with resend_email_id
        await supabase.from("ebd_email_logs").update({
          resend_email_id: emailResponse.data?.id || null,
        }).eq("id", logId);

        console.log(`ebd-email-cron: Sent ${templateCode} to ${destinatario}`);
      } catch (emailErr: any) {
        await supabase.from("ebd_email_logs").insert({
          template_id: template.id,
          cliente_id: cliente.id,
          vendedor_id: cliente.vendedor_id || null,
          destinatario,
          assunto,
          status: "erro",
          erro: emailErr.message,
          dados_enviados: variables,
          tipo_envio: "cron",
        });
        console.error(`ebd-email-cron: Error sending ${templateCode} to ${destinatario}:`, emailErr.message);
      }
    };

    let totalSent = 0;

    // === 1. Reposição 14 dias ===
    const in14days = new Date(today);
    in14days.setDate(in14days.getDate() + 14);
    const in14Str = in14days.toISOString().split("T")[0];

    const { data: clientes14d } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra")
      .eq("data_proxima_compra", in14Str)
      .not("email_superintendente", "is", null);

    for (const c of clientes14d || []) {
      await sendEmail(c, "ebd_reposicao_14d");
      totalSent++;
    }

    // === 2. Reposição 7 dias ===
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7Str = in7days.toISOString().split("T")[0];

    const { data: clientes7d } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra")
      .eq("data_proxima_compra", in7Str)
      .not("email_superintendente", "is", null);

    for (const c of clientes7d || []) {
      await sendEmail(c, "ebd_reposicao_7d");
      totalSent++;
    }

    // === 3. Reposição hoje ===
    const { data: clientesHoje } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra")
      .eq("data_proxima_compra", todayStr)
      .not("email_superintendente", "is", null);

    for (const c of clientesHoje || []) {
      await sendEmail(c, "ebd_reposicao_hoje");
      totalSent++;
    }

    // === 4. Ativação 3 dias (cadastro há 3 dias, não ativou) ===
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysStr = threeDaysAgo.toISOString().split("T")[0];

    const { data: clientes3d } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra, created_at")
      .eq("status_ativacao_ebd", false)
      .gte("created_at", `${threeDaysStr}T00:00:00.000Z`)
      .lte("created_at", `${threeDaysStr}T23:59:59.999Z`)
      .not("email_superintendente", "is", null);

    for (const c of clientes3d || []) {
      await sendEmail(c, "ebd_ativacao_3d");
      totalSent++;
    }

    // === 5. Ativação 7 dias ===
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

    const { data: clientes7dAtiv } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra, created_at")
      .eq("status_ativacao_ebd", false)
      .gte("created_at", `${sevenDaysStr}T00:00:00.000Z`)
      .lte("created_at", `${sevenDaysStr}T23:59:59.999Z`)
      .not("email_superintendente", "is", null);

    for (const c of clientes7dAtiv || []) {
      await sendEmail(c, "ebd_ativacao_7d");
      totalSent++;
    }

    // === 6. Cliente inativo (30+ dias sem login) ===
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysStr = thirtyDaysAgo.toISOString().split("T")[0];

    const { data: clientesInativos } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, vendedor_id, data_proxima_compra, ultimo_login")
      .eq("status_ativacao_ebd", true)
      .lt("ultimo_login", `${thirtyDaysStr}T23:59:59.999Z`)
      .not("email_superintendente", "is", null)
      .not("ultimo_login", "is", null);

    for (const c of clientesInativos || []) {
      const diasSemLogin = Math.floor(
        (today.getTime() - new Date(c.ultimo_login).getTime()) / (1000 * 60 * 60 * 24)
      );
      await sendEmail(c, "ebd_cliente_inativo", {
        dias_sem_login: String(diasSemLogin),
      });
      totalSent++;
    }

    console.log(`ebd-email-cron: Finished. Total processed: ${totalSent}`);

    return new Response(
      JSON.stringify({ success: true, totalProcessed: totalSent }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("ebd-email-cron: Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
