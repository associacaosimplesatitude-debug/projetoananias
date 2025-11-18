import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
  pastorName: string;
  pastorEmail: string;
  churchName: string;
  password: string;
  loginUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pastorName, pastorEmail, churchName, password, loginUrl }: WelcomeEmailRequest = await req.json();

    console.log('Sending welcome email to:', pastorEmail);

    const emailResponse = await resend.emails.send({
      from: "Sistema de Abertura de Igrejas <onboarding@resend.dev>",
      to: [pastorEmail],
      subject: `Bem-vindo(a) ao Sistema - ${churchName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
              .credentials { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
              .credential-item { margin: 10px 0; }
              .credential-label { font-weight: bold; color: #667eea; }
              .credential-value { background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bem-vindo ao Sistema!</h1>
              </div>
              <div class="content">
                <p>Olá <strong>${pastorName}</strong>,</p>
                
                <p>Seu cadastro foi realizado com sucesso! A igreja <strong>${churchName}</strong> foi registrada em nosso sistema.</p>
                
                <div class="credentials">
                  <h3 style="margin-top: 0; color: #667eea;">Seus Dados de Acesso</h3>
                  
                  <div class="credential-item">
                    <div class="credential-label">📧 Email:</div>
                    <div class="credential-value">${pastorEmail}</div>
                  </div>
                  
                  <div class="credential-item">
                    <div class="credential-label">🔑 Senha:</div>
                    <div class="credential-value">${password}</div>
                  </div>
                  
                  <div class="credential-item">
                    <div class="credential-label">🌐 Link de Acesso:</div>
                    <div class="credential-value">${loginUrl}</div>
                  </div>
                </div>

                <p><strong>⚠️ Importante:</strong> Recomendamos que você altere sua senha no primeiro acesso.</p>
                
                <div style="text-align: center;">
                  <a href="${loginUrl}" class="button">Acessar Sistema</a>
                </div>
                
                <p>Se você tiver alguma dúvida ou precisar de ajuda, não hesite em entrar em contato conosco.</p>
                
                <p>Atenciosamente,<br><strong>Equipe de Suporte</strong></p>
              </div>
              
              <div class="footer">
                <p>Este é um e-mail automático, por favor não responda.</p>
                <p>© ${new Date().getFullYear()} Sistema de Abertura de Igrejas. Todos os direitos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-welcome-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
