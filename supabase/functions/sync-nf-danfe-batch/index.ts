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
  console.log('[refreshBlingToken] Refreshing token...');
  
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

  console.log('[refreshBlingToken] Token refreshed successfully');
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

async function fetchNfeForOrder(
  blingOrderId: number,
  accessToken: string
): Promise<{ found: boolean; nfeNumero?: string; linkDanfe?: string; error?: string; situacao?: number }> {
  try {
    console.log(`[fetchNfeForOrder] Buscando NF-e para pedido ${blingOrderId}`);
    
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

    // Step 2: Extract NFe ID from order - multiple fallback paths
    let nfeId: number | null = null;
    
    // Path 1: notasFiscais array (most common)
    if (orderData.notasFiscais && Array.isArray(orderData.notasFiscais) && orderData.notasFiscais.length > 0) {
      nfeId = orderData.notasFiscais[0]?.id || null;
      if (nfeId) console.log(`[fetchNfeForOrder] NF-e ID encontrado via notasFiscais: ${nfeId}`);
    }
    
    // Path 2: notaFiscal object
    if (!nfeId && orderData.notaFiscal?.id) {
      nfeId = orderData.notaFiscal.id;
      console.log(`[fetchNfeForOrder] NF-e ID encontrado via notaFiscal: ${nfeId}`);
    }
    
    // Path 3: nfe object
    if (!nfeId && orderData.nfe?.id) {
      nfeId = orderData.nfe.id;
      console.log(`[fetchNfeForOrder] NF-e ID encontrado via nfe: ${nfeId}`);
    }

    // Path 4: Alternative endpoint - search NF-e by order ID
    if (!nfeId) {
      console.log(`[fetchNfeForOrder] Buscando NF-e via endpoint alternativo /nfe?idPedidoVenda=${blingOrderId}`);
      const nfesUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${blingOrderId}`;
      const nfesResult = await blingApiCall(nfesUrl, accessToken);
      
      if (nfesResult?.data && Array.isArray(nfesResult.data) && nfesResult.data.length > 0) {
        nfeId = nfesResult.data[0]?.id || null;
        if (nfeId) console.log(`[fetchNfeForOrder] NF-e ID encontrado via endpoint alternativo: ${nfeId}`);
      }
    }

    if (!nfeId) {
      return { found: false, error: 'NF-e não encontrada no pedido (todos os caminhos verificados)' };
    }

    // Step 3: Get NFe details
    const nfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeId}`;
    const nfeResult = await blingApiCall(nfeUrl, accessToken);

    if (nfeResult.notFound) {
      return { found: false, error: `NF-e ${nfeId} não encontrada` };
    }

    const nfeData = nfeResult?.data;
    if (!nfeData) {
      return { found: false, error: 'Dados da NF-e vazios' };
    }

    // Check if authorized (situacaoId === 6)
    const situacaoId = nfeData.situacao?.id || nfeData.situacao;
    if (situacaoId !== 6) {
      return { found: false, error: `NF-e não autorizada (situação: ${situacaoId})`, situacao: situacaoId };
    }

    // Extract DANFE link - multiple fallback paths
    const linkDanfe = 
      nfeData.linkDanfe || 
      nfeData.link_danfe || 
      nfeData.linkPDF ||
      nfeData.xml?.danfe ||
      nfeData.pdf ||
      null;
    
    const nfeNumero = nfeData.numero?.toString() || null;

    if (!linkDanfe) {
      console.log(`[fetchNfeForOrder] NF-e ${nfeId} autorizada mas sem linkDanfe disponível. Campos: ${JSON.stringify(Object.keys(nfeData))}`);
      return { found: false, error: 'Link DANFE não disponível na NF-e autorizada', situacao: situacaoId };
    }

    console.log(`[fetchNfeForOrder] ✓ NF-e ${nfeNumero} encontrada com DANFE link`);
    return { found: true, nfeNumero, linkDanfe, situacao: situacaoId };
  } catch (error) {
    console.error(`[fetchNfeForOrder] Erro:`, error);
    return { found: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-nf-danfe-batch] Starting batch sync...');

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

    // Fetch all parcelas from comissoes that need NF sync
    // (have bling_order_id but no link_danfe)
    interface ParcelaRow {
      id: string;
      bling_order_id: number | null;
      link_danfe: string | null;
      nota_fiscal_numero: string | null;
      shopify_pedido: {
        id: string;
        bling_order_id: number | null;
        nota_fiscal_url: string | null;
        nota_fiscal_numero: string | null;
      } | {
        id: string;
        bling_order_id: number | null;
        nota_fiscal_url: string | null;
        nota_fiscal_numero: string | null;
      }[] | null;
    }

    const { data: parcelas, error: parcelasError } = await supabase
      .from('vendedor_propostas_parcelas')
      .select(`
        id,
        bling_order_id,
        link_danfe,
        nota_fiscal_numero,
        shopify_pedido:ebd_shopify_pedidos(
          id,
          bling_order_id,
          nota_fiscal_url,
          nota_fiscal_numero
        )
      `)
      .is('link_danfe', null)
      .order('data_vencimento', { ascending: false });

    if (parcelasError) {
      throw new Error(`Erro ao buscar parcelas: ${parcelasError.message}`);
    }

    const parcelaList = (parcelas || []) as ParcelaRow[];
    console.log(`[sync-nf-danfe-batch] Found ${parcelaList.length} parcelas without link_danfe`);

    // Helper to get bling_order_id from shopify_pedido
    const getShopifyBlingId = (sp: ParcelaRow['shopify_pedido']): number | null => {
      if (!sp) return null;
      if (Array.isArray(sp)) return sp[0]?.bling_order_id || null;
      return sp.bling_order_id || null;
    };

    // Filter only those that have bling_order_id
    const parcelasToProcess = parcelaList.filter(p => {
      const blingId = p.bling_order_id || getShopifyBlingId(p.shopify_pedido);
      return !!blingId;
    });

    console.log(`[sync-nf-danfe-batch] ${parcelasToProcess.length} parcelas have bling_order_id`);

    const results = {
      total: parcelasToProcess.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as { id: string; bling_order_id: number | null; error: string; situacao?: number }[],
    };

    // Process each parcela
    for (const parcela of parcelasToProcess) {
      const blingOrderId = parcela.bling_order_id || getShopifyBlingId(parcela.shopify_pedido);

      if (!blingOrderId) {
        results.skipped++;
        continue;
      }

      console.log(`[sync-nf-danfe-batch] Processing parcela ${parcela.id} with blingOrderId ${blingOrderId}`);

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
          results.errors.push({ id: parcela.id, bling_order_id: blingOrderId, error: `Update failed: ${updateError.message}` });
        } else {
          results.success++;
          console.log(`[sync-nf-danfe-batch] ✓ Updated parcela ${parcela.id} with NF ${nfeResult.nfeNumero}`);
        }
      } else {
        results.failed++;
        results.errors.push({ 
          id: parcela.id, 
          bling_order_id: blingOrderId,
          error: nfeResult.error || 'NF não encontrada',
          situacao: nfeResult.situacao
        });
      }

      // Rate limit: 300ms between calls
      await delay(300);
    }

    console.log(`[sync-nf-danfe-batch] Complete: ${results.success} success, ${results.failed} failed, ${results.skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${results.success} atualizados, ${results.failed} falhas, ${results.skipped} ignorados`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-nf-danfe-batch] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
