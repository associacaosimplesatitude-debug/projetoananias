import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to get user info
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for service role operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the cliente EBD for this user
    const { data: clienteData, error: clienteError } = await supabaseAdmin
      .from('ebd_clientes')
      .select('id, email_superintendente')
      .eq('superintendente_user_id', user.id)
      .maybeSingle();

    if (clienteError) {
      console.error('Error fetching cliente:', clienteError);
      return new Response(
        JSON.stringify({ error: 'Error fetching cliente data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clienteData) {
      return new Response(
        JSON.stringify({ linked: 0, message: 'No cliente found for this user' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!clienteData.email_superintendente) {
      return new Response(
        JSON.stringify({ linked: 0, message: 'No email_superintendente set' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Link orphan orders: update where cliente_id IS NULL and customer_email matches
    const { data: updatedOrders, error: updateError } = await supabaseAdmin
      .from('ebd_shopify_pedidos')
      .update({ cliente_id: clienteData.id })
      .is('cliente_id', null)
      .ilike('customer_email', clienteData.email_superintendente)
      .select('id, order_number');

    if (updateError) {
      console.error('Error linking orphan orders:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error linking orphan orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const linkedCount = updatedOrders?.length || 0;
    console.log(`Linked ${linkedCount} orphan orders for cliente ${clienteData.id} (email: ${clienteData.email_superintendente})`);

    return new Response(
      JSON.stringify({ 
        linked: linkedCount,
        orders: updatedOrders?.map(o => o.order_number) || [],
        cliente_id: clienteData.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
