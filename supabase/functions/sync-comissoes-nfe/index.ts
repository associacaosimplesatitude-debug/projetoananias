import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return expiry <= new Date();
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log('[sync-comissoes-nfe] Refreshing token...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  console.log('[sync-comissoes-nfe] Token refreshed successfully');
  return tokenData.access_token;
}

async function blingApiCall(
  url: string,
  accessToken: string,
  retries = 2
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log(`[blingApiCall] Rate limited, waiting 2s...`);
        await delay(2000);
        continue;
      }

      if (response.status === 404) {
        return { notFound: true };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bling API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await delay(1000);
    }
  }
}

// Busca bling_order_id pelo número do pedido Shopify
async function findBlingOrderId(
  orderNumber: string,
  accessToken: string
): Promise<number | null> {
  // Remove # and get clean number
  let cleanNumero = orderNumber.replace('#', '').toUpperCase().trim();
  
  // Skip #D*** orders (internal/proposals) - they don't exist in Bling
  if (cleanNumero.startsWith('D')) {
    console.log('[findBlingOrderId] Skipping internal order:', orderNumber);
    return null;
  }

  console.log('[findBlingOrderId] Searching by numeroLoja:', cleanNumero);
  
  const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?numeroLoja=${encodeURIComponent(cleanNumero)}&limite=20`;
  const result = await blingApiCall(searchUrl, accessToken);
  
  if (result?.data && result.data.length > 0) {
    // Find exact match
    const matchingOrder = result.data.find((order: any) => {
      const orderNumeroLoja = (order.numeroLoja || '').toString().replace('#', '').toUpperCase().trim();
      return orderNumeroLoja === cleanNumero;
    });
    
    if (matchingOrder) {
      console.log('[findBlingOrderId] ✓ Found by numeroLoja:', matchingOrder.id);
      return matchingOrder.id;
    }
  }
  
  return null;
}

// Busca NF-e pelo bling_order_id
async function fetchNfeForOrder(
  blingOrderId: number,
  accessToken: string
): Promise<{ found: boolean; nfeNumero?: string; linkDanfe?: string; error?: string }> {
  try {
    // Step 1: Get order details
    const orderUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
    const orderResult = await blingApiCall(orderUrl, accessToken);

    if (orderResult.notFound) {
      return { found: false, error: 'Pedido não encontrado no Bling' };
    }

    const orderData = orderResult?.data;
    if (!orderData) {
      return { found: false, error: 'Dados do pedido vazios' };
    }

    // Step 2: Extract NFe ID from order
    let nfeId: number | null = null;
    
    // Try notasFiscais array
    if (orderData.notasFiscais && Array.isArray(orderData.notasFiscais) && orderData.notasFiscais.length > 0) {
      nfeId = orderData.notasFiscais[0]?.id || null;
    }
    
    // Try notaFiscal object
    if (!nfeId && orderData.notaFiscal?.id) {
      nfeId = orderData.notaFiscal.id;
    }
    
    // Try nfe object
    if (!nfeId && orderData.nfe?.id) {
      nfeId = orderData.nfe.id;
    }

    if (!nfeId) {
      return { found: false, error: 'NF-e não encontrada no pedido' };
    }

    // Step 3: Get NFe details
    const nfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeId}`;
    const nfeResult = await blingApiCall(nfeUrl, accessToken);

    if (nfeResult.notFound) {
      return { found: false, error: 'NF-e não encontrada' };
    }

    const nfeData = nfeResult?.data;
    if (!nfeData) {
      return { found: false, error: 'Dados da NF-e vazios' };
    }

    // Check if authorized (situacaoId === 6)
    const situacaoId = nfeData.situacao?.id || nfeData.situacao;
    if (situacaoId !== 6) {
      return { found: false, error: `NF-e não autorizada (situação: ${situacaoId})` };
    }

    // Extract DANFE link
    const linkDanfe = nfeData.linkDanfe || nfeData.link_danfe || nfeData.xml?.danfe || null;
    const nfeNumero = nfeData.numero?.toString() || null;

    if (!linkDanfe) {
      return { found: false, error: 'Link DANFE não disponível' };
    }

    return { found: true, nfeNumero, linkDanfe };
  } catch (error) {
    return { found: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

interface ParcelaRow {
  id: string;
  vendedor_id: string | null;
  bling_order_id: number | null;
  link_danfe: string | null;
  nota_fiscal_numero: string | null;
  origem: string;
  shopify_pedido_id: string | null;
  shopify_pedido?: {
    id: string;
    order_number: string | null;
    bling_order_id: number | null;
    nota_fiscal_url: string | null;
    nota_fiscal_numero: string | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-comissoes-nfe] Starting sync...');

    // Fetch Bling config
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      throw new Error('Configuração Bling não encontrada');
    }

    let accessToken = blingConfig.access_token;

    // Refresh token if expired
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Fetch parcelas online sem link_danfe
    const { data: parcelas, error: parcelasError } = await supabase
      .from('vendedor_propostas_parcelas')
      .select(`
        id,
        vendedor_id,
        bling_order_id,
        link_danfe,
        nota_fiscal_numero,
        origem,
        shopify_pedido_id,
        shopify_pedido:ebd_shopify_pedidos(
          id,
          order_number,
          bling_order_id,
          nota_fiscal_url,
          nota_fiscal_numero
        )
      `)
      .is('link_danfe', null)
      .in('origem', ['online', 'mercadopago'])
      .not('vendedor_id', 'is', null)
      .order('data_vencimento', { ascending: false });

    if (parcelasError) {
      throw new Error(`Erro ao buscar parcelas: ${parcelasError.message}`);
    }

    const parcelaList = (parcelas || []) as unknown as ParcelaRow[];
    console.log(`[sync-comissoes-nfe] Found ${parcelaList.length} online parcelas without link_danfe`);

    const results = {
      total: parcelaList.length,
      phase1_bling_ids_found: 0,
      phase2_nfe_synced: 0,
      skipped_proposals: 0,
      failed: 0,
      errors: [] as { id: string; error: string }[],
    };

    // Helper to get shopify data
    const getShopifyData = (p: ParcelaRow) => {
      if (!p.shopify_pedido) return null;
      if (Array.isArray(p.shopify_pedido)) return p.shopify_pedido[0] || null;
      return p.shopify_pedido;
    };

    for (const parcela of parcelaList) {
      const shopify = getShopifyData(parcela);
      
      // Get order_number from shopify_pedido
      const orderNumber = shopify?.order_number || null;
      
      // Skip #D*** orders (proposals) - they don't exist individually in Bling
      if (orderNumber && orderNumber.startsWith('#D')) {
        console.log(`[sync-comissoes-nfe] Skipping proposal order: ${orderNumber}`);
        results.skipped_proposals++;
        continue;
      }

      // Get bling_order_id - from parcela, or from shopify_pedido
      let blingOrderId = parcela.bling_order_id || shopify?.bling_order_id || null;

      // === PHASE 1: If no bling_order_id, try to find it via API ===
      if (!blingOrderId && orderNumber) {
        console.log(`[sync-comissoes-nfe] Phase 1: Finding bling_order_id for ${orderNumber}`);
        
        try {
          blingOrderId = await findBlingOrderId(orderNumber, accessToken);
          
          if (blingOrderId) {
            results.phase1_bling_ids_found++;
            
            // Update ebd_shopify_pedidos with the bling_order_id
            if (shopify?.id) {
              await supabase
                .from('ebd_shopify_pedidos')
                .update({ bling_order_id: blingOrderId })
                .eq('id', shopify.id);
              console.log(`[sync-comissoes-nfe] ✓ Updated shopify_pedido with bling_order_id: ${blingOrderId}`);
            }
          }
        } catch (error) {
          console.error(`[sync-comissoes-nfe] Error finding bling_order_id for ${orderNumber}:`, error);
        }
        
        // Rate limiting
        await delay(400);
      }

      // === PHASE 2: If we have bling_order_id, fetch NF-e ===
      if (blingOrderId) {
        console.log(`[sync-comissoes-nfe] Phase 2: Fetching NF-e for bling_order_id ${blingOrderId}`);
        
        try {
          const nfeResult = await fetchNfeForOrder(blingOrderId, accessToken);
          
          if (nfeResult.found && nfeResult.linkDanfe) {
            // Update parcela with NF info
            const { error: updateError } = await supabase
              .from('vendedor_propostas_parcelas')
              .update({
                link_danfe: nfeResult.linkDanfe,
                nota_fiscal_numero: nfeResult.nfeNumero || null,
              })
              .eq('id', parcela.id);

            if (updateError) {
              results.failed++;
              results.errors.push({ id: parcela.id, error: `Update failed: ${updateError.message}` });
            } else {
              results.phase2_nfe_synced++;
              console.log(`[sync-comissoes-nfe] ✓ Updated parcela ${parcela.id} with NF ${nfeResult.nfeNumero}`);
              
              // Also update shopify_pedido if we have it
              if (shopify?.id) {
                await supabase
                  .from('ebd_shopify_pedidos')
                  .update({
                    nota_fiscal_url: nfeResult.linkDanfe,
                    nota_fiscal_numero: nfeResult.nfeNumero || null,
                  })
                  .eq('id', shopify.id);
              }
            }
          } else {
            results.failed++;
            results.errors.push({ id: parcela.id, error: nfeResult.error || 'NF não encontrada' });
          }
        } catch (error) {
          results.failed++;
          results.errors.push({ 
            id: parcela.id, 
            error: error instanceof Error ? error.message : 'Erro ao buscar NF' 
          });
        }
        
        // Rate limiting
        await delay(400);
      } else {
        // No bling_order_id and couldn't find it
        if (orderNumber) {
          results.failed++;
          results.errors.push({ id: parcela.id, error: `Pedido ${orderNumber} não encontrado no Bling` });
        }
      }
    }

    console.log(`[sync-comissoes-nfe] Complete:`, results);

    const message = `Sincronização concluída: ${results.phase1_bling_ids_found} pedidos vinculados ao Bling, ${results.phase2_nfe_synced} NF-e sincronizadas, ${results.skipped_proposals} propostas ignoradas, ${results.failed} falhas`;

    return new Response(
      JSON.stringify({
        success: true,
        message,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-comissoes-nfe] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
