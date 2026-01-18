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
      const cleanNumero = numeroLoja.replace('#', '').toUpperCase().trim();
      
      const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?numeroLoja=${encodeURIComponent(cleanNumero)}&limite=20`;
      const { data: searchResult, newToken } = await blingApiCall(searchUrl, accessToken, supabase, blingConfig);
      
      if (newToken) accessToken = newToken;

      if (searchResult?.data && searchResult.data.length > 0) {
        console.log('[bling-find-order-id] API returned', searchResult.data.length, 'orders. Checking for exact match...');
        console.log('[bling-find-order-id] Looking for numeroLoja:', cleanNumero);
        console.log('[bling-find-order-id] Returned numeroLojas:', searchResult.data.map((o: any) => o.numeroLoja));
        
        // CRITICAL: Find EXACT match - API may return unrelated results
        const matchingOrder = searchResult.data.find((order: any) => {
          const orderNumeroLoja = (order.numeroLoja || '').toString().replace('#', '').toUpperCase().trim();
          return orderNumeroLoja === cleanNumero;
        });
        
        if (matchingOrder) {
          console.log('[bling-find-order-id] ✓ Exact match found! Order ID:', matchingOrder.id, 'numeroLoja:', matchingOrder.numeroLoja);
          
          return new Response(
            JSON.stringify({ 
              blingOrderId: matchingOrder.id,
              numeroLoja: matchingOrder.numeroLoja,
              strategy: 'numeroLoja'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          console.log('[bling-find-order-id] ✗ No exact match for numeroLoja:', cleanNumero, '- API returned different orders');
        }
      } else {
        console.log('[bling-find-order-id] No orders returned from API for numeroLoja:', cleanNumero);
      }
    }

    // Strategy 2: Search by contact email + date range (mais rigorosa)
    if (customerEmail) {
      console.log('[bling-find-order-id] Strategy 2: Searching by email:', customerEmail);
      
      // Find contact by email
      const contactUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(customerEmail)}`;
      const { data: contactResult, newToken: ct1 } = await blingApiCall(contactUrl, accessToken, supabase, blingConfig);
      
      if (ct1) accessToken = ct1;

      if (contactResult?.data && contactResult.data.length > 0) {
        // CRITICAL: Find exact email match (case-insensitive)
        const normalizedEmail = customerEmail.trim().toLowerCase();
        const exactContact = contactResult.data.find((c: any) => {
          const contactEmail = (c.email || '').trim().toLowerCase();
          return contactEmail === normalizedEmail;
        });
        
        if (!exactContact) {
          console.log('[bling-find-order-id] No exact email match found. Returned contacts:', 
            contactResult.data.map((c: any) => c.email));
        } else {
          const contactId = exactContact.id;
          console.log('[bling-find-order-id] Found exact contact match. ID:', contactId, 'Email:', exactContact.email);
          
          // Search orders by contact
          let ordersUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?idContato=${contactId}&limite=20`;
          
          if (orderDate) {
            const date = new Date(orderDate);
            const startDate = new Date(date);
            startDate.setDate(startDate.getDate() - 14);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 14);
            ordersUrl += `&dataInicial=${startDate.toISOString().split('T')[0]}&dataFinal=${endDate.toISOString().split('T')[0]}`;
          }
          
          const { data: ordersResult, newToken: ct2 } = await blingApiCall(ordersUrl, accessToken, supabase, blingConfig);
          
          if (ct2) accessToken = ct2;

          if (ordersResult?.data && ordersResult.data.length > 0) {
            const targetValue = Number(orderValue) || 0;
            
            // Find orders within tolerance (max R$ 5 difference)
            const tolerance = 5;
            const matchingOrders = ordersResult.data.filter((order: any) => {
              const diff = Math.abs(Number(order.total || order.totalVenda || 0) - targetValue);
              return diff <= tolerance;
            });
            
            console.log('[bling-find-order-id] Orders within tolerance (R$', tolerance, '):', matchingOrders.length);
            
            if (matchingOrders.length === 1) {
              // Único match - seguro retornar
              console.log('[bling-find-order-id] ✓ Unique match found:', matchingOrders[0].id, 'value:', matchingOrders[0].total);
              
              return new Response(
                JSON.stringify({ 
                  blingOrderId: matchingOrders[0].id,
                  numeroLoja: matchingOrders[0].numeroLoja,
                  strategy: 'contact_email_exact'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            } else if (matchingOrders.length > 1) {
              console.log('[bling-find-order-id] ✗ Multiple orders match - ambiguous, not returning any');
              console.log('[bling-find-order-id] Matching orders:', matchingOrders.map((o: any) => ({ id: o.id, valor: o.total, numero: o.numero })));
            } else {
              console.log('[bling-find-order-id] No orders within R$', tolerance, 'tolerance. Values found:', 
                ordersResult.data.map((o: any) => o.total));
            }
          }
        }
      }
      console.log('[bling-find-order-id] Strategy 2 failed - no conclusive match');
    }

    // Strategy 3: Search by value + date range (fallback - muito mais rigorosa)
    if (orderValue && orderDate) {
      console.log('[bling-find-order-id] Strategy 3: Searching by value + date (strict mode)');
      
      const date = new Date(orderDate);
      const startDate = new Date(date);
      startDate.setDate(startDate.getDate() - 3);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 3);
      
      const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${startDate.toISOString().split('T')[0]}&dataFinal=${endDate.toISOString().split('T')[0]}&limite=50`;
      const { data: searchResult } = await blingApiCall(searchUrl, accessToken, supabase, blingConfig);

      if (searchResult?.data && searchResult.data.length > 0) {
        const targetValue = Number(orderValue);
        
        // STRICT: Only accept orders within R$ 2 tolerance
        const strictTolerance = 2;
        const matchingOrders = searchResult.data.filter((order: any) => {
          const orderTotal = Number(order.total || order.totalVenda || 0);
          const diff = Math.abs(orderTotal - targetValue);
          return diff <= strictTolerance;
        });
        
        console.log('[bling-find-order-id] Orders within R$', strictTolerance, 'tolerance:', matchingOrders.length);
        
        if (matchingOrders.length === 1) {
          // ÚNICO match - podemos retornar com confiança
          console.log('[bling-find-order-id] ✓ Unique value match found:', matchingOrders[0].id, 'value:', matchingOrders[0].total);
          
          return new Response(
            JSON.stringify({ 
              blingOrderId: matchingOrders[0].id,
              numeroLoja: matchingOrders[0].numeroLoja,
              strategy: 'value_date_unique'
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (matchingOrders.length > 1) {
          // MÚLTIPLOS matches - NÃO retornar nenhum para evitar associar errado
          console.log('[bling-find-order-id] ✗ Multiple orders match value - AMBIGUOUS, refusing to guess');
          console.log('[bling-find-order-id] Candidates:', matchingOrders.map((o: any) => ({ id: o.id, valor: o.total, numero: o.numero })));
          // NÃO retornar - deixar cair para o erro final
        } else {
          console.log('[bling-find-order-id] No orders within strict tolerance. All values:', 
            searchResult.data.slice(0, 10).map((o: any) => o.total));
        }
      }
      console.log('[bling-find-order-id] Strategy 3 failed - no unique match');
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
