import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  clienteId: string;
  templateCode: string;
  dados?: Record<string, string>;
  vendedorId?: string;
  tipoEnvio?: string;
  destinatarioOverride?: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-ebd-email: Request received");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clienteId, templateCode, dados, vendedorId, tipoEnvio, destinatarioOverride }: EmailRequest = await req.json();

    console.log(`send-ebd-email: Processing template '${templateCode}' for cliente '${clienteId}'`);

    if (!clienteId || !templateCode) {
      throw new Error("Missing required fields: clienteId and templateCode are required");
    }

    // 1. Fetch template
    const { data: template, error: templateError } = await supabase
      .from("ebd_email_templates")
      .select("*")
      .eq("codigo", templateCode)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      throw new Error(`Template '${templateCode}' not found or is inactive`);
    }

    // 2. Fetch cliente data
    const { data: cliente, error: clienteError } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, nome_responsavel, email_superintendente, telefone, vendedor_id, data_proxima_compra, status_ativacao_ebd, ultimo_login")
      .eq("id", clienteId)
      .single();

    if (clienteError || !cliente) {
      throw new Error(`Cliente with ID '${clienteId}' not found`);
    }

    // 3. Fetch vendedor data
    const vId = vendedorId || cliente.vendedor_id;
    let vendedor: { nome: string; email: string; telefone?: string } | null = null;
    if (vId) {
      const { data: v } = await supabase
        .from("vendedores")
        .select("id, nome, email")
        .eq("id", vId)
        .single();
      vendedor = v;
    }

    // 4. Prepare variables
    const variables: Record<string, string> = {
      nome: cliente.nome_responsavel || cliente.nome_igreja,
      nome_igreja: cliente.nome_igreja,
      vendedor_nome: vendedor?.nome || "Equipe Central Gospel",
      vendedor_telefone: vendedor?.email || "",
      link_painel: "https://gestaoebd.lovable.app/login/ebd",
      link_catalogo: "https://gestaoebd.lovable.app/vendedor/catalogo",
      data_proxima_compra: cliente.data_proxima_compra 
        ? new Date(cliente.data_proxima_compra).toLocaleDateString("pt-BR") 
        : "N/A",
      ...dados,
    };

    // 5. Replace variables in subject and body
    let assunto = template.assunto;
    let corpo = template.corpo_html;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      assunto = assunto.replace(regex, value || "");
      corpo = corpo.replace(regex, value || "");
    }

    // 6. Determine recipient
    const destinatario = destinatarioOverride || cliente.email_superintendente;
    if (!destinatario) {
      throw new Error("No email address available for recipient");
    }

    // 7. Insert log FIRST to get logId for tracking
    const { data: logRow, error: logError } = await supabase.from("ebd_email_logs").insert({
      template_id: template.id,
      cliente_id: clienteId,
      vendedor_id: vId || null,
      destinatario,
      assunto,
      status: "enviado",
      dados_enviados: variables,
      tipo_envio: tipoEnvio || "manual",
    }).select("id").single();

    if (logError) {
      console.error("send-ebd-email: Error creating log:", logError);
      throw new Error("Failed to create email log");
    }

    const logId = logRow.id;
    const trackerBaseUrl = `${supabaseUrl}/functions/v1/ebd-email-tracker`;

    // 8. Inject tracking pixel and rewrite links
    // Rewrite <a href="..."> to go through tracker
    corpo = corpo.replace(/<a\s+([^>]*?)href="([^"]*)"([^>]*)>/gi, (_match: string, before: string, href: string, after: string) => {
      // Skip mailto: and tel: links
      if (href.startsWith("mailto:") || href.startsWith("tel:")) {
        return `<a ${before}href="${href}"${after}>`;
      }
      const trackedUrl = `${trackerBaseUrl}?type=click&logId=${logId}&url=${encodeURIComponent(href)}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    });

    // Add tracking pixel at the end of the body
    const trackingPixel = `<img src="${trackerBaseUrl}?type=open&logId=${logId}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`;
    if (corpo.includes("</body>")) {
      corpo = corpo.replace("</body>", `${trackingPixel}</body>`);
    } else {
      corpo += trackingPixel;
    }

    // 9. Send via Resend
    console.log(`send-ebd-email: Sending to '${destinatario}'`);
    const emailResponse = await resend.emails.send({
      from: "Relatorios <relatorios@painel.editoracentralgospel.com.br>",
      to: [destinatario],
      subject: assunto,
      html: corpo,
    });

    console.log("send-ebd-email: Email sent:", emailResponse);

    // 10. Update log with resend_email_id
    await supabase.from("ebd_email_logs").update({
      resend_email_id: emailResponse.data?.id || null,
    }).eq("id", logId);

    return new Response(
      JSON.stringify({ success: true, message: "Email enviado com sucesso", emailId: emailResponse.data?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("send-ebd-email: Error:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await req.clone().json().catch(() => ({}));
        if (body.clienteId) {
          const { data: template } = await supabase
            .from("ebd_email_templates")
            .select("id")
            .eq("codigo", body.templateCode)
            .single();

          await supabase.from("ebd_email_logs").insert({
            template_id: template?.id || null,
            cliente_id: body.clienteId,
            vendedor_id: body.vendedorId || null,
            destinatario: body.destinatarioOverride || "unknown",
            assunto: "Erro ao enviar",
            status: "erro",
            erro: error.message,
            dados_enviados: body.dados || {},
            tipo_envio: body.tipoEnvio || "manual",
          });
        }
      }
    } catch (logErr) {
      console.error("Error logging failure:", logErr);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
