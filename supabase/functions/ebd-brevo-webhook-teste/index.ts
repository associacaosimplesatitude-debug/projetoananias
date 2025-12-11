import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-brevo-signature, x-sib-webhook-id',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  // Test endpoint - GET request to verify the webhook is working
  if (req.method === 'GET' && url.searchParams.get('test') === 'true') {
    console.log('=== Test endpoint called ===');
    return new Response(JSON.stringify({ 
      status: 'active',
      message: 'Webhook de TESTE ativo - SEM AUTENTICAÇÃO',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('=== Brevo webhook TESTE (sem auth) received ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    
    // Log all headers for debugging
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.log('Headers:', JSON.stringify(headersObj));

    // SEM VALIDAÇÃO DE AUTENTICAÇÃO - APENAS PARA TESTE
    console.log('⚠️ MODO TESTE: Aceitando todas as requisições sem autenticação');

    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // Extract event and email - Brevo can send in different formats
    const event = payload.event || payload.type || payload.eventType;
    const email = payload.email || payload.recipient || payload.to;
    
    console.log('Extracted event type:', event);
    console.log('Extracted email:', email);

    if (!email) {
      console.log('No email in payload, skipping');
      return new Response(JSON.stringify({ success: true, message: 'No email to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle email open and click events
    const trackableEvents = ['opened', 'click', 'unique_opened', 'open', 'uniqueOpened', 'delivered', 'trackOpened'];
    const eventLower = event?.toLowerCase() || '';
    const isTrackable = trackableEvents.some(e => eventLower.includes(e.toLowerCase()));
    
    if (isTrackable) {
      console.log(`Processing trackable event: ${event} for email: ${email}`);
      
      // First check if lead exists
      const { data: existingLead, error: fetchError } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, email, email_aberto, lead_score')
        .ilike('email', email)
        .maybeSingle();
      
      console.log('Fetch result:', { existingLead, fetchError });
      
      if (!existingLead) {
        console.log('Lead not found for email:', email);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Lead not found',
          email 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // Update the lead
      const { data: updateData, error: updateError } = await supabase
        .from('ebd_leads_reativacao')
        .update({ 
          email_aberto: true,
          lead_score: 'Morno',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingLead.id)
        .select();

      if (updateError) {
        console.error('Error updating lead:', updateError);
        return new Response(JSON.stringify({ 
          error: 'Failed to update lead', 
          details: updateError.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('✅ Successfully updated lead to Morno:', updateData);
      return new Response(JSON.stringify({ 
        success: true, 
        event, 
        email,
        updated: updateData 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      console.log(`Event type "${event}" not tracked`);
    }

    return new Response(JSON.stringify({ success: true, event, email, processed: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
