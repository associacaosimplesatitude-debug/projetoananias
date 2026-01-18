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
  console.log('[backfill-bling] Refreshing Bling token...');
  
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
    console.error('[backfill-bling] Token refresh failed:', errorText);
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

  console.log('[backfill-bling] Token refreshed successfully');
  return tokenData.access_token;
}

async function blingApiCall(
  url: string,
  accessToken: string,
  supabase: any,
  config: any
): Promise<{ data: any; newToken?: string }> {
  let response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 401) {
    console.log('[backfill-bling] Token expired, refreshing...');
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

async function findBlingOrderId(
  supabase: any,
  blingConfig: any,
  accessToken: string,
  orderNumber: string | null,
  orderValue: number | null,
  orderDate: string | null
): Promise<{ blingOrderId: number | null; strategy: string | null; newToken?: string }> {
  let currentToken = accessToken;

  // Strategy 1: Search by numeroLoja (Shopify order number) - MOST RELIABLE
  if (orderNumber) {
    // Clean order number: remove # and D prefix
    let cleanNumero = orderNumber.replace('#', '').toUpperCase().trim();
    // Skip if it's a #D*** order (internal) - these don't exist in Bling
    if (cleanNumero.startsWith('D')) {
      console.log('[backfill-bling] Skipping internal order:', orderNumber);
      return { blingOrderId: null, strategy: null, newToken: currentToken };
    }
    
    console.log('[backfill-bling] Strategy 1: Searching by numeroLoja:', cleanNumero);
    
    const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?numeroLoja=${encodeURIComponent(cleanNumero)}&limite=20`;
    const { data: searchResult, newToken } = await blingApiCall(searchUrl, currentToken, supabase, blingConfig);
    
    if (newToken) currentToken = newToken;

    if (searchResult?.data && searchResult.data.length > 0) {
      // CRITICAL: Find EXACT match
      const matchingOrder = searchResult.data.find((order: any) => {
        const orderNumeroLoja = (order.numeroLoja || '').toString().replace('#', '').toUpperCase().trim();
        return orderNumeroLoja === cleanNumero;
      });
      
      if (matchingOrder) {
        console.log('[backfill-bling] ✓ Found by numeroLoja:', matchingOrder.id);
        return { blingOrderId: matchingOrder.id, strategy: 'numeroLoja', newToken: currentToken };
      }
    }
  }

  // Strategy 2: Search by value + date range (fallback - strict)
  if (orderValue && orderDate) {
    console.log('[backfill-bling] Strategy 2: Searching by value + date');
    
    const date = new Date(orderDate);
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 5);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 5);
    
    const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?dataInicial=${startDate.toISOString().split('T')[0]}&dataFinal=${endDate.toISOString().split('T')[0]}&limite=100`;
    const { data: searchResult, newToken } = await blingApiCall(searchUrl, currentToken, supabase, blingConfig);
    
    if (newToken) currentToken = newToken;

    if (searchResult?.data && searchResult.data.length > 0) {
      const targetValue = Number(orderValue);
      
      // STRICT: Only accept orders within R$ 2 tolerance
      const strictTolerance = 2;
      const matchingOrders = searchResult.data.filter((order: any) => {
        const orderTotal = Number(order.total || order.totalVenda || 0);
        const diff = Math.abs(orderTotal - targetValue);
        return diff <= strictTolerance;
      });
      
      if (matchingOrders.length === 1) {
        console.log('[backfill-bling] ✓ Found unique match by value/date:', matchingOrders[0].id);
        return { blingOrderId: matchingOrders[0].id, strategy: 'value_date_unique', newToken: currentToken };
      } else if (matchingOrders.length > 1) {
        console.log('[backfill-bling] ✗ Multiple matches, skipping (ambiguous)');
      }
    }
  }

  return { blingOrderId: null, strategy: null, newToken: currentToken };
}

interface ShopifyPedido {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  valor_total: number | null;
  order_date: string | null;
  bling_order_id: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results = {
      phase1_shopify_orders_updated: 0,
      phase2_parcelas_relinked: 0,
      phase3_bling_ids_found: 0,
      failed: 0,
      details: [] as any[]
    };

    // Fetch Bling config
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      console.error('[backfill-bling] Config error:', configError);
      throw new Error('Bling config not found');
    }

    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // ==== PHASE 1: Find bling_order_id for Shopify orders (#****) without it ====
    console.log('[backfill-bling] PHASE 1: Finding bling_order_id for Shopify orders...');
    
    const { data: shopifyOrders, error: ordersError } = await supabase
      .from('ebd_shopify_pedidos')
      .select('id, order_number, customer_name, valor_total, order_date, bling_order_id')
      .is('bling_order_id', null)
      .not('order_number', 'ilike', '#D%')
      .order('created_at', { ascending: false });

    if (ordersError) {
      console.error('[backfill-bling] Error fetching orders:', ordersError);
    } else {
      console.log('[backfill-bling] Found', shopifyOrders?.length || 0, 'Shopify orders without bling_order_id');
      
      for (const order of (shopifyOrders || [])) {
        try {
          const { blingOrderId, strategy, newToken } = await findBlingOrderId(
            supabase,
            blingConfig,
            accessToken,
            order.order_number,
            order.valor_total,
            order.order_date
          );

          if (newToken) accessToken = newToken;

          if (blingOrderId) {
            const { error: updateError } = await supabase
              .from('ebd_shopify_pedidos')
              .update({ bling_order_id: blingOrderId })
              .eq('id', order.id);

            if (!updateError) {
              results.phase1_shopify_orders_updated++;
              console.log('[backfill-bling] ✓ Updated Shopify order:', order.order_number, '-> bling_order_id:', blingOrderId);
            }
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
          console.error('[backfill-bling] Error in phase 1:', err);
          results.failed++;
        }
      }
    }

    // ==== PHASE 2: Re-link parcelas from #D*** to matching #**** with bling_order_id ====
    console.log('[backfill-bling] PHASE 2: Re-linking parcelas from internal orders to Shopify orders...');
    
    // Find parcelas linked to #D*** orders
    const { data: internalParcelas, error: parcelasError } = await supabase
      .from('vendedor_propostas_parcelas')
      .select(`
        id,
        shopify_pedido_id,
        valor,
        shopify_pedido:ebd_shopify_pedidos(id, order_number, customer_name, valor_total, bling_order_id)
      `)
      .not('shopify_pedido_id', 'is', null);

    if (parcelasError) {
      console.error('[backfill-bling] Error fetching parcelas:', parcelasError);
    } else {
      const parcelasToRelink = (internalParcelas || []).filter((p: any) => {
        const shopify = Array.isArray(p.shopify_pedido) ? p.shopify_pedido[0] : p.shopify_pedido;
        return shopify && 
               shopify.order_number?.startsWith('#D') && 
               !shopify.bling_order_id;
      });

      console.log('[backfill-bling] Found', parcelasToRelink.length, 'parcelas linked to internal orders');

      for (const parcela of parcelasToRelink) {
        const currentShopify = Array.isArray(parcela.shopify_pedido) 
          ? parcela.shopify_pedido[0] 
          : parcela.shopify_pedido;
        
        if (!currentShopify) continue;

        // Find a matching Shopify order (#****) with bling_order_id
        const { data: matchingOrders } = await supabase
          .from('ebd_shopify_pedidos')
          .select('id, order_number, customer_name, valor_total, bling_order_id')
          .eq('customer_name', currentShopify.customer_name)
          .not('order_number', 'ilike', '#D%')
          .not('bling_order_id', 'is', null);

        if (matchingOrders && matchingOrders.length > 0) {
          // Find best match by value (within R$ 1 tolerance)
          const parcelaValor = Number(currentShopify.valor_total || parcela.valor);
          const bestMatch = matchingOrders.find((m: any) => 
            Math.abs(Number(m.valor_total) - parcelaValor) < 1
          );

          if (bestMatch) {
            const { error: updateError } = await supabase
              .from('vendedor_propostas_parcelas')
              .update({ shopify_pedido_id: bestMatch.id })
              .eq('id', parcela.id);

            if (!updateError) {
              results.phase2_parcelas_relinked++;
              console.log('[backfill-bling] ✓ Relinked parcela:', parcela.id, 
                'from', currentShopify.order_number, 
                'to', bestMatch.order_number,
                '(bling_order_id:', bestMatch.bling_order_id, ')');
            }
          }
        }
      }
    }

    // ==== PHASE 3: Final count of items now with bling_order_id ====
    const { data: finalCheck } = await supabase
      .from('vendedor_propostas_parcelas')
      .select(`
        id,
        shopify_pedido:ebd_shopify_pedidos(bling_order_id)
      `)
      .not('shopify_pedido_id', 'is', null);

    const withBlingId = (finalCheck || []).filter((p: any) => {
      const shopify = Array.isArray(p.shopify_pedido) ? p.shopify_pedido[0] : p.shopify_pedido;
      return shopify?.bling_order_id;
    });

    results.phase3_bling_ids_found = withBlingId.length;

    console.log('[backfill-bling] Completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Fase 1: ${results.phase1_shopify_orders_updated} pedidos Shopify atualizados. Fase 2: ${results.phase2_parcelas_relinked} parcelas re-vinculadas. Total com bling_order_id: ${results.phase3_bling_ids_found}`,
        ...results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[backfill-bling] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
