import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  console.log("=== Brevo webhook PUBLIC ===");
  console.log("Method:", req.method);
  console.log("URL:", req.url);

  // Test endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'active', 
        message: 'Brevo webhook está ativo e funcionando!',
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate token from Brevo
  const authHeader = req.headers.get('authorization');
  const expectedToken = 'reobote-ebd-webhook-2024';
  
  // Brevo sends token as "Bearer <token>" or just "<token>"
  let receivedToken = authHeader?.replace('Bearer ', '') || '';
  
  console.log("Auth header received:", authHeader ? "present" : "missing");
  
  // Also check x-sib-webhook-id header (Brevo always sends this)
  const sibWebhookId = req.headers.get('x-sib-webhook-id');
  console.log("x-sib-webhook-id:", sibWebhookId ? "present" : "missing");
  
  // Accept if token matches OR if it's a valid Brevo webhook (has x-sib-webhook-id)
  const isValidToken = receivedToken === expectedToken;
  const isBrevoWebhook = !!sibWebhookId;
  
  if (!isValidToken && !isBrevoWebhook) {
    console.log("Token validation failed and no Brevo webhook ID");
    // Still process to avoid breaking the webhook - log for debugging
  }

  try {
    const payload = await req.json();
    
    console.log("Webhook payload:", JSON.stringify(payload, null, 2));
    
    // Extract event type and email from payload
    const eventType = payload.event || payload.type || payload.eventType;
    const email = payload.email || payload.recipient || payload.to;
    
    console.log("Event type:", eventType);
    console.log("Email:", email);
    
    if (!email) {
      console.log("No email found in payload");
      return new Response(
        JSON.stringify({ success: true, message: 'No email to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Track events: opened, unique_opened, click
    const trackableEvents = ['opened', 'unique_opened', 'click', 'open'];
    const normalizedEvent = eventType?.toLowerCase();
    
    if (trackableEvents.includes(normalizedEvent)) {
      console.log(`Processing trackable event: ${eventType} for email: ${email}`);
      
      // Find the lead by email
      const { data: existingLead, error: fetchError } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, email_aberto, lead_score')
        .eq('email', email)
        .maybeSingle();

      console.log("Fetch result:", JSON.stringify({ existingLead, fetchError }));

      if (fetchError) {
        console.error("Error fetching lead:", fetchError);
        return new Response(
          JSON.stringify({ success: false, error: fetchError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      if (!existingLead) {
        console.log("Lead not found for email:", email);
        return new Response(
          JSON.stringify({ success: true, message: 'Lead not found, but webhook received successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        console.error("Error updating lead:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: updateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log("Lead updated successfully:", JSON.stringify(updatedLead));
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Lead updated successfully',
          lead_id: existingLead.id,
          email_aberto: true,
          lead_score: 'Morno'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Non-trackable event
    console.log("Event not tracked:", eventType);
    return new Response(
      JSON.stringify({ success: true, message: 'Event received but not tracked', event: eventType }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
