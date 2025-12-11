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

  try {
    console.log('=== Brevo webhook received ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    // Get the webhook secret for validation (optional but recommended)
    const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET');
    console.log('Webhook secret configured:', !!webhookSecret);
    
    // If webhook secret is configured, validate the request
    if (webhookSecret) {
      const signature = req.headers.get('x-brevo-signature');
      const sibWebhookId = req.headers.get('x-sib-webhook-id');
      const authHeader = req.headers.get('authorization');
      
      console.log('Signature header:', signature);
      console.log('SIB Webhook ID:', sibWebhookId);
      console.log('Auth header present:', !!authHeader);
      
      // Brevo uses different authentication methods depending on setup
      // Check multiple possible validation methods
      const isValidAuth = 
        (authHeader && authHeader === `Bearer ${webhookSecret}`) ||
        (signature && signature === webhookSecret) ||
        (sibWebhookId); // Accept if has Brevo webhook ID header
      
      if (!isValidAuth) {
        console.error('Invalid webhook authentication - rejecting request');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Authentication passed');
    } else {
      console.log('No webhook secret configured - accepting all requests');
    }

    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload, null, 2));

    // Brevo sends different event types
    // For email tracking, we look for "opened", "click", "unique_opened" events
    const event = payload.event;
    const email = payload.email;
    
    console.log('Event type:', event);
    console.log('Email:', email);

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

    // Handle different event types - track email opens and clicks
    const trackableEvents = ['opened', 'click', 'unique_opened', 'open', 'uniqueOpened'];
    
    if (trackableEvents.includes(event)) {
      console.log(`Processing ${event} event for email: ${email}`);
      
      // First, check if the lead exists
      const { data: existingLead, error: fetchError } = await supabase
        .from('ebd_leads_reativacao')
        .select('id, email_aberto, lead_score')
        .eq('email', email.toLowerCase())
        .single();
      
      if (fetchError) {
        console.error('Error fetching lead:', fetchError);
        
        // Try case-insensitive search with ilike
        const { data: leadsByIlike, error: ilikeError } = await supabase
          .from('ebd_leads_reativacao')
          .select('id, email_aberto, lead_score')
          .ilike('email', email);
        
        if (ilikeError) {
          console.error('Error with ilike search:', ilikeError);
        } else {
          console.log('Found leads with ilike:', leadsByIlike);
        }
      } else {
        console.log('Found existing lead:', existingLead);
      }
      
      // Update the lead's email_aberto status AND lead_score to 'Morno'
      const { data, error } = await supabase
        .from('ebd_leads_reativacao')
        .update({ 
          email_aberto: true,
          lead_score: 'Morno',
          updated_at: new Date().toISOString()
        })
        .eq('email', email.toLowerCase())
        .select();

      if (error) {
        console.error('Error updating lead with eq:', error);
        
        // Try with ilike as fallback
        const { data: updateData, error: updateError } = await supabase
          .from('ebd_leads_reativacao')
          .update({ 
            email_aberto: true,
            lead_score: 'Morno',
            updated_at: new Date().toISOString()
          })
          .ilike('email', email)
          .select();
        
        if (updateError) {
          console.error('Error updating lead with ilike:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update lead', details: updateError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        console.log('Successfully updated lead with ilike. Updated records:', updateData);
      } else {
        console.log(`Successfully updated email_aberto and lead_score to Morno for: ${email}. Updated records:`, data);
      }
    } else {
      console.log(`Event type "${event}" not tracked, skipping. Trackable events are:`, trackableEvents);
    }

    return new Response(JSON.stringify({ success: true, event, email }), {
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
