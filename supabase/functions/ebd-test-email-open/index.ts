import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // GET request - test endpoint with email parameter
  if (req.method === 'GET') {
    const email = url.searchParams.get('email');
    
    if (!email) {
      return new Response(
        JSON.stringify({ 
          status: 'info', 
          message: 'Endpoint de teste para simular abertura de email',
          usage: 'GET ?email=exemplo@email.com',
          timestamp: new Date().toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`=== Simulando abertura de email para: ${email} ===`);

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Find the lead by email
      const { data: existingLead, error: fetchError } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, email, email_aberto, lead_score, nome_igreja')
        .eq('email', email)
        .maybeSingle();

      console.log("Lead encontrado:", JSON.stringify(existingLead));

      if (fetchError) {
        console.error("Erro ao buscar lead:", fetchError);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!existingLead) {
        console.log("Lead não encontrado para email:", email);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: `Lead não encontrado para email: ${email}`,
            hint: 'Verifique se o email está cadastrado na tabela ebd_leads_reativacao'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      // Update lead: mark email as opened and update score to "Morno"
      const { data: updatedLead, error: updateError } = await supabase
        .from('ebd_leads_reativacao')
        .update({
          email_aberto: true,
          lead_score: 'Morno',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLead.id)
        .select()
        .single();

      if (updateError) {
        console.error("Erro ao atualizar lead:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log("Lead atualizado com sucesso:", JSON.stringify(updatedLead));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead atualizado com sucesso!',
          lead: {
            id: existingLead.id,
            email: existingLead.email,
            nome_igreja: existingLead.nome_igreja,
            antes: {
              email_aberto: existingLead.email_aberto,
              lead_score: existingLead.lead_score
            },
            depois: {
              email_aberto: true,
              lead_score: 'Morno'
            }
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error("Erro:", error);
      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
  }

  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 405 }
  );
});
