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
  autorId: string;
  templateCode: string;
  dados: Record<string, string>;
  destinatarioOverride?: string;
}

interface Template {
  id: string;
  codigo: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  variaveis: string[];
  is_active: boolean;
}

interface Autor {
  id: string;
  nome_completo: string;
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-royalties-email: Request received");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { autorId, templateCode, dados, destinatarioOverride }: EmailRequest = await req.json();

    console.log(`send-royalties-email: Processing template '${templateCode}' for autor '${autorId}'`);

    // Validate required fields
    if (!autorId || !templateCode) {
      throw new Error("Missing required fields: autorId and templateCode are required");
    }

    // 1. Fetch template from database
    const { data: template, error: templateError } = await supabase
      .from("royalties_email_templates")
      .select("*")
      .eq("codigo", templateCode)
      .eq("is_active", true)
      .single();

    if (templateError || !template) {
      console.error("Template not found or inactive:", templateError);
      throw new Error(`Template '${templateCode}' not found or is inactive`);
    }

    console.log(`send-royalties-email: Found template '${template.nome}'`);

    // 2. Fetch autor data
    const { data: autor, error: autorError } = await supabase
      .from("royalties_autores")
      .select("id, nome_completo, email")
      .eq("id", autorId)
      .single();

    if (autorError || !autor) {
      console.error("Autor not found:", autorError);
      throw new Error(`Autor with ID '${autorId}' not found`);
    }

    console.log(`send-royalties-email: Found autor '${autor.nome_completo}'`);

    // 3. Prepare variables - merge autor data with provided dados
    const variables: Record<string, string> = {
      nome: autor.nome_completo,
      email: autor.email,
      ...dados,
    };

    // 4. Replace variables in subject and body
    let assunto = template.assunto;
    let corpo = template.corpo_html;

    // Replace all {variable} placeholders
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, "g");
      assunto = assunto.replace(regex, value || "");
      corpo = corpo.replace(regex, value || "");
    }

    console.log(`send-royalties-email: Variables replaced. Subject: '${assunto}'`);

    // 5. Determine recipient
    const destinatario = destinatarioOverride || autor.email;

    if (!destinatario) {
      throw new Error("No email address available for recipient");
    }

    // 6. Send email via Resend
    console.log(`send-royalties-email: Sending email to '${destinatario}'`);

    const emailResponse = await resend.emails.send({
      from: "Relatorios <relatorios@painel.editoracentralgospel.com.br>",
      to: [destinatario],
      subject: assunto,
      html: corpo,
    });

    console.log("send-royalties-email: Email sent successfully:", emailResponse);

    // 7. Log the email in database
    const { error: logError } = await supabase
      .from("royalties_email_logs")
      .insert({
        template_id: template.id,
        autor_id: autorId,
        destinatario: destinatario,
        assunto: assunto,
        status: "enviado",
        dados_enviados: variables,
      });

    if (logError) {
      console.error("Error logging email:", logError);
      // Don't throw - email was sent successfully, just log the error
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email enviado com sucesso",
        emailId: emailResponse.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("send-royalties-email: Error:", error);

    // Try to log the error in database if we have the necessary info
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const body = await req.clone().json().catch(() => ({}));
        
        if (body.autorId && body.templateCode) {
          // Try to get template ID
          const { data: template } = await supabase
            .from("royalties_email_templates")
            .select("id")
            .eq("codigo", body.templateCode)
            .single();

          await supabase.from("royalties_email_logs").insert({
            template_id: template?.id || null,
            autor_id: body.autorId,
            destinatario: body.destinatarioOverride || "unknown",
            assunto: "Erro ao enviar",
            status: "erro",
            erro: error.message,
            dados_enviados: body.dados || {},
          });
        }
      }
    } catch (logErr) {
      console.error("Error logging failure:", logErr);
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
