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
    const cleanNumero = orderNumber.replace('#', '').toUpperCase().trim();
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
  valor_total: number | null;
  order_date: string | null;
  bling_order_id: number | null;
}

interface ParcelaItem {
  id: string;
  valor: number;
  data_vencimento: string;
  shopify_pedido_id: string | null;
  shopify_pedido: ShopifyPedido | ShopifyPedido[] | null;
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

    // Fetch items from commissions panel that need bling_order_id
    // These are the ones showing "Sem vínculo"
    const { data: parcelas, error: parcelasError } = await supabase
      .from('vendedor_propostas_parcelas')
      .select(`
        id,
        valor,
        data_vencimento,
        shopify_pedido_id,
        shopify_pedido:ebd_shopify_pedidos(
          id,
          order_number,
          valor_total,
          order_date,
          bling_order_id
        )
      `)
      .not('shopify_pedido_id', 'is', null)
      .order('data_vencimento', { ascending: false });

    if (parcelasError) {
      console.error('[backfill-bling] Error fetching parcelas:', parcelasError);
      throw parcelasError;
    }

    // Helper to get shopify_pedido as single object (Supabase can return array or object)
    const getShopifyPedido = (item: ParcelaItem): ShopifyPedido | null => {
      if (!item.shopify_pedido) return null;
      if (Array.isArray(item.shopify_pedido)) {
        return item.shopify_pedido[0] || null;
      }
      return item.shopify_pedido;
    };

    // Filter to only those without bling_order_id
    const itemsToProcess = ((parcelas || []) as ParcelaItem[]).filter((p) => {
      const shopifyPedido = getShopifyPedido(p);
      return shopifyPedido && !shopifyPedido.bling_order_id && shopifyPedido.order_number;
    });

    console.log('[backfill-bling] Found', itemsToProcess.length, 'items to process');

    if (itemsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum item sem vínculo encontrado',
          processed: 0,
          updated: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const results = {
      processed: 0,
      updated: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each item with rate limiting
    for (const item of itemsToProcess) {
      const shopifyPedido = getShopifyPedido(item)!;
      results.processed++;

      console.log('[backfill-bling] Processing:', {
        parcela_id: item.id,
        order_number: shopifyPedido.order_number,
        valor: shopifyPedido.valor_total,
        date: shopifyPedido.order_date
      });

      try {
        const { blingOrderId, strategy, newToken } = await findBlingOrderId(
          supabase,
          blingConfig,
          accessToken,
          shopifyPedido.order_number,
          shopifyPedido.valor_total || item.valor,
          shopifyPedido.order_date || item.data_vencimento
        );

        if (newToken) accessToken = newToken;

        if (blingOrderId) {
          // Update ebd_shopify_pedidos
          const { error: updateError } = await supabase
            .from('ebd_shopify_pedidos')
            .update({ bling_order_id: blingOrderId })
            .eq('id', shopifyPedido.id);

          if (updateError) {
            console.error('[backfill-bling] Error updating:', updateError);
            results.failed++;
            results.details.push({
              parcela_id: item.id,
              order_number: shopifyPedido.order_number,
              status: 'error',
              error: updateError.message
            });
          } else {
            results.updated++;
            results.details.push({
              parcela_id: item.id,
              order_number: shopifyPedido.order_number,
              bling_order_id: blingOrderId,
              strategy,
              status: 'updated'
            });
            console.log('[backfill-bling] ✓ Updated order_number:', shopifyPedido.order_number, '-> bling_order_id:', blingOrderId);
          }
        } else {
          results.failed++;
          results.details.push({
            parcela_id: item.id,
            order_number: shopifyPedido.order_number,
            status: 'not_found'
          });
          console.log('[backfill-bling] ✗ Not found:', shopifyPedido.order_number);
        }

        // Rate limiting: wait 300ms between API calls to avoid Bling rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (err) {
        console.error('[backfill-bling] Error processing item:', err);
        results.failed++;
        results.details.push({
          parcela_id: item.id,
          order_number: shopifyPedido.order_number,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    console.log('[backfill-bling] Completed:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processados ${results.processed} itens. Atualizados: ${results.updated}. Falhas: ${results.failed}`,
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
