import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMinutes = 5;
  return expiresAt.getTime() - now.getTime() < bufferMinutes * 60 * 1000;
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log('[bling-find-order-id] Refreshing Bling token...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: `grant_type=refresh_token&refresh_token=${config.refresh_token}`,
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('[bling-find-order-id] Token refresh failed:', errorText);
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase.from('bling_config').update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('id', config.id);

  console.log('[bling-find-order-id] Token refreshed successfully');
  return tokenData.access_token;
}

async function blingApiCall(
  url: string,
  accessToken: string,
  supabase: any,
  config: any
): Promise<{ data: any; newToken?: string }> {
  console.log('[bling-find-order-id] Calling Bling API:', url);
  
  let response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401) {
    console.log('[bling-find-order-id] Token expired, refreshing...');
    const newToken = await refreshBlingToken(supabase, config);
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${newToken}`,
        'Accept': 'application/json',
      },
    });
    const data = await response.json();
    return { data, newToken };
  }

  const data = await response.json();
  return { data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { customerEmail, orderValue, orderDate, numeroLoja } = body;

    console.log('[bling-find-order-id] Request:', { customerEmail, orderValue, orderDate, numeroLoja });

    if (!customerEmail && !numeroLoja) {
      return new Response(
        JSON.stringify({ error: 'customerEmail or numeroLoja required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch Bling config
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      console.error('[bling-find-order-id] Config error:', configError);
      return new Response(
        JSON.stringify({ error: 'Bling config not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Strategy 1: Search by numeroLoja (Shopify order number)
    if (numeroLoja) {
      console.log('[bling-find-order-id] Strategy 1: Searching by numeroLoja:', numeroLoja);
      const cleanNumero = numeroLoja.replace('#', '');
      
      const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?numeroLoja=${encodeURIComponent(cleanNumero)}&limite=5`;
      const { data: searchResult, newToken } = await blingApiCall(searchUrl, accessToken, supabase, blingConfig);
      
      if (newToken) accessToken = newToken;

      if (searchResult?.data && searchResult.data.length > 0) {
        const order = searchResult.data[0];
        console.log('[bling-find-order-id] Found order by numeroLoja:', order.id);
        
        return new Response(
          JSON.stringify({ 
            blingOrderId: order.id,
            numeroLoja: order.numeroLoja,
            strategy: 'numeroLoja'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[bling-find-order-id] No order found by numeroLoja');
    }

    // Strategy 2: Search by contact email + date range
    if (customerEmail) {
      console.log('[bling-find-order-id] Strategy 2: Searching by email:', customerEmail);
      
      // First, find contact by email
      const contactSearchUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(customerEmail)}&limite=5`;
      const { data: contactResult, newToken: newToken2 } = await blingApiCall(contactSearchUrl, accessToken, supabase, blingConfig);
      
      if (newToken2) accessToken = newToken2;

      let contactId: number | null = null;
      if (contactResult?.data && contactResult.data.length > 0) {
        contactId = contactResult.data[0].id;
        console.log('[bling-find-order-id] Found contact:', contactId);
      }

      if (contactId) {
        // Search orders by contact
        let ordersUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?idContato=${contactId}&limite=20`;
        
        // Add date range if available
        if (orderDate) {
          const date = new Date(orderDate);
          const startDate = new Date(date);
          startDate.setDate(startDate.getDate() - 30);
          const endDate = new Date(date);
          endDate.setDate(endDate.getDate() + 30);
          
          ordersUrl += `&dataInicial=${startDate.toISOString().split('T')[0]}&dataFinal=${endDate.toISOString().split('T')[0]}`;
        }

        const { data: ordersResult, newToken: newToken3 } = await blingApiCall(ordersUrl, accessToken, supabase, blingConfig);
        if (newToken3) accessToken = newToken3;

        if (ordersResult?.data && ordersResult.data.length > 0) {
          let bestMatch = ordersResult.data[0];
          
          // If we have orderValue, find closest match
          if (orderValue) {
            let minDiff = Math.abs((ordersResult.data[0].total || 0) - orderValue);
            for (const order of ordersResult.data) {
              const diff = Math.abs((order.total || 0) - orderValue);
              if (diff < minDiff) {
                minDiff = diff;
                bestMatch = order;
              }
            }
          }

          console.log('[bling-find-order-id] Found order by contact:', bestMatch.id, 'total:', bestMatch.total);
          
          return new Response(
            JSON.stringify({ 
              blingOrderId: bestMatch.id,
              numeroLoja: bestMatch.numeroLoja,
              strategy: 'contactEmail'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      console.log('[bling-find-order-id] No order found by contact');
    }

    // Strategy 3: Search by value range + date (fallback - broad search)
    if (orderValue && orderDate) {
      console.log('[bling-find-order-id] Strategy 3: Searching by value/date range');
      
      const date = new Date(orderDate);
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 7);
      
      const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${startDate.toISOString().split('T')[0]}&dataFinal=${endDate.toISOString().split('T')[0]}&limite=50`;
      const { data: searchResult } = await blingApiCall(searchUrl, accessToken, supabase, blingConfig);

      if (searchResult?.data && searchResult.data.length > 0) {
        // Find best match by value
        let bestMatch = null;
        let minDiff = 10; // Max 10 BRL difference
        
        for (const order of searchResult.data) {
          const diff = Math.abs((order.total || 0) - orderValue);
          if (diff < minDiff) {
            minDiff = diff;
            bestMatch = order;
          }
        }

        if (bestMatch) {
          console.log('[bling-find-order-id] Found order by value/date:', bestMatch.id);
          
          return new Response(
            JSON.stringify({ 
              blingOrderId: bestMatch.id,
              numeroLoja: bestMatch.numeroLoja,
              strategy: 'valueDateRange'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      console.log('[bling-find-order-id] No order found by value/date');
    }

    console.log('[bling-find-order-id] No order found with any strategy');
    return new Response(
      JSON.stringify({ blingOrderId: null, message: 'No matching order found in Bling' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[bling-find-order-id] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
