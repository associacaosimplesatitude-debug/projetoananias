import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadToActivate {
  id: string;
  email: string;
  nome_igreja: string;
  nome_responsavel?: string;
  senha_temporaria?: string;
}

interface BatchRequest {
  lead_ids: string[];
  custom_password?: string;
  access_link?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting batch email sending');

    // Initialize clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }
    const resend = new Resend(resendApiKey);

    // Parse request body
    const { lead_ids, custom_password = 'mudar123', access_link = 'https://app.ananias.com.br' }: BatchRequest = await req.json();

    if (!lead_ids || lead_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No leads provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${lead_ids.length} leads`);

    // Fetch leads from database
    const { data: leads, error: fetchError } = await supabase
      .from('ebd_leads_reativacao')
      .select('id, email, nome_igreja, nome_responsavel')
      .in('id', lead_ids)
      .not('email', 'is', null);

    if (fetchError) {
      console.error('Error fetching leads:', fetchError);
      throw fetchError;
    }

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid leads found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${leads.length} leads with valid emails`);

    const results = {
      success: [] as string[],
      failed: [] as { id: string; email: string; error: string }[],
    };

    // Send emails to each lead
    for (const lead of leads as LeadToActivate[]) {
      if (!lead.email) continue;

      try {
        const emailHtml = generateActivationEmail({
          nome_igreja: lead.nome_igreja,
          nome_responsavel: lead.nome_responsavel || 'Responsável',
          senha: custom_password,
          link_acesso: access_link,
        });

        const { error: emailError } = await resend.emails.send({
          from: 'EBD Ananias <noreply@ananias.com.br>',
          to: [lead.email],
          subject: 'Ative sua conta EBD - Acesso Liberado!',
          html: emailHtml,
        });

        if (emailError) {
          console.error(`Failed to send to ${lead.email}:`, emailError);
          results.failed.push({
            id: lead.id,
            email: lead.email,
            error: emailError.message || 'Unknown error',
          });
        } else {
          console.log(`Email sent successfully to ${lead.email}`);
          results.success.push(lead.id);

          // Update lead status in database
          await supabase
            .from('ebd_leads_reativacao')
            .update({
              status_lead: 'email_enviado',
              email_nota: `E-mail de ativação enviado em ${new Date().toLocaleDateString('pt-BR')}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (sendError) {
        console.error(`Error sending to ${lead.email}:`, sendError);
        results.failed.push({
          id: lead.id,
          email: lead.email,
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
      }
    }

    console.log(`Batch complete: ${results.success.length} success, ${results.failed.length} failed`);

    return new Response(JSON.stringify({
      success: true,
      sent: results.success.length,
      failed: results.failed.length,
      details: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in batch send:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface EmailTemplateData {
  nome_igreja: string;
  nome_responsavel: string;
  senha: string;
  link_acesso: string;
}

function generateActivationEmail(data: EmailTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ativação de Conta EBD</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">EBD Ananias</h1>
              <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 14px;">Sistema de Gestão de Escola Bíblica Dominical</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="color: #1e3a5f; margin: 0 0 20px 0; font-size: 22px;">Olá, ${data.nome_responsavel}!</h2>
              
              <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                Sua conta EBD para <strong>${data.nome_igreja}</strong> está pronta para ser ativada!
              </p>
              
              <div style="background-color: #f0f9ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h3 style="color: #1e40af; margin: 0 0 15px 0; font-size: 16px;">Dados de Acesso:</h3>
                <p style="color: #4a5568; margin: 5px 0; font-size: 14px;">
                  <strong>Senha temporária:</strong> 
                  <code style="background: #e0e7ff; padding: 2px 8px; border-radius: 4px; font-family: monospace; color: #1e40af;">${data.senha}</code>
                </p>
              </div>
              
              <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin: 0 0 25px 0;">
                ⚠️ <strong>Importante:</strong> Por segurança, altere sua senha após o primeiro acesso.
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${data.link_acesso}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);">
                  Acessar Minha Conta
                </a>
              </div>
              
              <p style="color: #718096; font-size: 13px; line-height: 1.6; margin: 25px 0 0 0; text-align: center;">
                Ou copie e cole este link no seu navegador:<br>
                <a href="${data.link_acesso}" style="color: #3b82f6; word-break: break-all;">${data.link_acesso}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f7fafc; padding: 25px 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="color: #718096; font-size: 12px; margin: 0 0 10px 0;">
                Este e-mail foi enviado automaticamente pelo sistema EBD Ananias.
              </p>
              <p style="color: #a0aec0; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} Editora Ananias. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
