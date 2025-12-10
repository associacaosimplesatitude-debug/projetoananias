import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-brevo-signature',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Brevo webhook received');
    
    // Get the webhook secret for validation (optional but recommended)
    const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET');
    
    // If webhook secret is configured, validate the request
    if (webhookSecret) {
      const signature = req.headers.get('x-brevo-signature');
      // Note: Brevo uses different authentication methods depending on setup
      // This is a simple secret-based validation
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${webhookSecret}` && signature !== webhookSecret) {
        console.error('Invalid webhook signature');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const payload = await req.json();
    console.log('Webhook payload:', JSON.stringify(payload));

    // Brevo sends different event types
    // For email tracking, we look for "opened" or "click" events
    const event = payload.event;
    const email = payload.email;

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

    // Handle different event types
    if (event === 'opened' || event === 'click' || event === 'unique_opened') {
      console.log(`Processing ${event} event for email: ${email}`);
      
      // Update the lead's email_aberto status
      const { data, error } = await supabase
        .from('ebd_leads_reativacao')
        .update({ 
          email_aberto: true,
          updated_at: new Date().toISOString()
        })
        .eq('email', email.toLowerCase());

      if (error) {
        console.error('Error updating lead:', error);
        return new Response(JSON.stringify({ error: 'Failed to update lead' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Successfully updated email_aberto for: ${email}`);
    } else {
      console.log(`Event type ${event} not tracked, skipping`);
    }

    return new Response(JSON.stringify({ success: true }), {
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
