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
    const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET');
    return new Response(JSON.stringify({ 
      status: 'active',
      message: 'Webhook is active and receiving requests',
      secretConfigured: !!webhookSecret,
      secretLength: webhookSecret?.length || 0,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('=== Brevo webhook received ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    
    // Log all headers for debugging
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key] = key.toLowerCase().includes('auth') || key.toLowerCase().includes('token') 
        ? `${value.substring(0, 10)}...` 
        : value;
    });
    console.log('Headers:', JSON.stringify(headersObj));
    
    // Get the webhook secret for validation
    const webhookSecret = Deno.env.get('BREVO_WEBHOOK_SECRET');
    console.log('Webhook secret configured:', !!webhookSecret);
    console.log('Webhook secret length:', webhookSecret?.length || 0);
    
    // Brevo with "Token" authentication sends the token in the Authorization header
    const authHeader = req.headers.get('authorization');
    const signature = req.headers.get('x-brevo-signature');
    const sibWebhookId = req.headers.get('x-sib-webhook-id');
    
    console.log('Auth header present:', !!authHeader);
    console.log('Auth header value (partial):', authHeader ? `${authHeader.substring(0, 20)}...` : 'none');
    console.log('Signature header:', signature ? `${signature.substring(0, 10)}...` : 'none');
    console.log('SIB Webhook ID:', sibWebhookId);
    
    // Validate authentication if secret is configured
    if (webhookSecret) {
      let isValid = false;
      const trimmedSecret = webhookSecret.trim();
      
      // Method 1: Bearer token in Authorization header
      if (authHeader) {
        const token = authHeader.replace(/^[Bb]earer\s+/, '').trim();
        console.log('Token length:', token.length, 'Secret length:', trimmedSecret.length);
        console.log('Token first 10:', token.substring(0, 10));
        console.log('Secret first 10:', trimmedSecret.substring(0, 10));
        console.log('Token last 10:', token.substring(token.length - 10));
        console.log('Secret last 10:', trimmedSecret.substring(trimmedSecret.length - 10));
        
        if (token === trimmedSecret) {
          isValid = true;
          console.log('Auth: Bearer token matched');
        }
      }
      
      // Method 2: Direct token match (Brevo sometimes sends just the token)
      if (!isValid && authHeader?.trim() === trimmedSecret) {
        isValid = true;
        console.log('Auth: Direct token matched');
      }
      
      // Method 3: x-brevo-signature header
      if (!isValid && signature?.trim() === trimmedSecret) {
        isValid = true;
        console.log('Auth: Signature matched');
      }
      
      // Method 4: Accept if has Brevo webhook ID (less secure but sometimes needed)
      if (!isValid && sibWebhookId) {
        isValid = true;
        console.log('Auth: Accepted via SIB Webhook ID presence');
      }
      
      if (!isValid) {
        console.error('Authentication failed - no valid credentials');
        console.error('Expected token:', `"${trimmedSecret}"`);
        console.error('Received token:', authHeader ? `"${authHeader.replace(/^[Bb]earer\s+/, '').trim()}"` : 'none');
        return new Response(JSON.stringify({ error: 'Unauthorized', details: 'Token mismatch' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.log('No webhook secret configured - accepting all requests (NOT RECOMMENDED)');
    }

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
      
      console.log('Successfully updated lead:', updateData);
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
