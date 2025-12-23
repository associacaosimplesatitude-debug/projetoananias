import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('Renovando token do Bling...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error) {
    console.error('Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('Token renovado com sucesso! Expira em:', expiresAt.toISOString());
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function detectMarketplace(order: any, debug = false): string | null {
  // Collect all fields to check
  const lojaDescricao = (order.loja?.descricao || '').toLowerCase();
  const lojaNome = (order.loja?.nome || '').toLowerCase();
  const lojaId = order.loja?.id;
  const canal = (order.canal || '').toLowerCase();
  const origemDescricao = (order.origem?.descricao || '').toLowerCase();
  const origemNome = (order.origem?.nome || '').toLowerCase();
  const numeroPedidoLoja = (order.numeroPedidoLoja || '').toLowerCase();
  const observacoes = (order.observacoes || '').toLowerCase();
  const observacoesInternas = (order.observacoesInternas || '').toLowerCase();
  
  // Combine all text fields to search
  const allText = `${lojaDescricao} ${lojaNome} ${canal} ${origemDescricao} ${origemNome} ${numeroPedidoLoja} ${observacoes} ${observacoesInternas}`;
  
  if (debug) {
    console.log(`Order ${order.numero}: loja=${lojaDescricao}|${lojaNome}, canal=${canal}, origem=${origemDescricao}|${origemNome}, numeroPedidoLoja=${numeroPedidoLoja}`);
  }
  
  // Check for Shopee (most common patterns)
  if (allText.includes('shopee') || 
      numeroPedidoLoja.match(/^\d{15,}/) || // Shopee order numbers are usually 15+ digits
      lojaDescricao.includes('ecg shopee') ||
      lojaNome.includes('shopee')) {
    return 'SHOPEE';
  }
  
  // Check for Amazon
  if (allText.includes('amazon') || 
      allText.includes('amzn') ||
      numeroPedidoLoja.match(/^\d{3}-\d{7}-\d{7}$/)) { // Amazon order format
    return 'AMAZON';
  }
  
  // Check for Mercado Livre
  if (allText.includes('mercado') || 
      allText.includes('meli') || 
      allText.includes('mercadolivre') ||
      allText.includes('ml_') ||
      numeroPedidoLoja.match(/^\d{10,12}$/)) { // ML order numbers are 10-12 digits
    return 'MERCADO_LIVRE';
  }
  
  // Check by loja ID (need to be configured per Bling account)
  // Common Bling integration IDs for marketplaces
  if (lojaId) {
    // These are typical integration names in Bling
    const lojaIdStr = String(lojaId).toLowerCase();
    if (lojaIdStr.includes('shopee')) return 'SHOPEE';
    if (lojaIdStr.includes('amazon')) return 'AMAZON';
    if (lojaIdStr.includes('mercado')) return 'MERCADO_LIVRE';
  }
  
  return null;
}

function mapBlingStatusToLocal(situacao: any): string {
  const id = situacao?.id || situacao?.valor || 0;
  const nome = (situacao?.nome || situacao?.descricao || '').toLowerCase();
  
  // Map Bling status IDs/names to our status
  if (id === 9 || nome.includes('atendido')) return 'Atendido';
  if (id === 15 || nome.includes('aberto') || nome.includes('em aberto')) return 'Em Aberto';
  if (id === 12 || nome.includes('cancelado')) return 'Cancelado';
  if (id === 6 || nome.includes('aprovado') || nome.includes('pago')) return 'Pago';
  if (nome.includes('pendente')) return 'Pendente';
  if (nome.includes('enviado')) return 'Enviado';
  if (nome.includes('verificado')) return 'Verificado';
  if (nome.includes('entregue')) return 'Entregue';
  
  return situacao?.nome || 'Desconhecido';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { marketplace, debug } = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Bling config
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração Bling não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso não configurado');
    }

    // Refresh token if needed
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado, renovando...');
      accessToken = await refreshBlingToken(supabase, config);
    }

    let allOrders: any[] = [];
    let page = 1;
    let hasMore = true;

    console.log('Buscando pedidos de vendas do Bling...');

    // Fetch all sales orders from Bling
    while (hasMore) {
      console.log(`Buscando página ${page}...`);
      
      if (page > 1) {
        await delay(400); // Rate limit: 3 req/s
      }

      // Build URL with date filter (last 90 days)
      const dataInicial = new Date();
      dataInicial.setDate(dataInicial.getDate() - 90);
      const dataInicialStr = dataInicial.toISOString().split('T')[0];

      const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${dataInicialStr}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.log('Rate limit, aguardando...');
          await delay(2000);
          continue;
        }
        throw new Error(`Erro ao buscar pedidos: ${response.status}`);
      }

      const data = await response.json();
      const orders = data.data || [];
      
      console.log(`Página ${page}: ${orders.length} pedidos encontrados`);
      
      allOrders = [...allOrders, ...orders];
      
      hasMore = orders.length === 100;
      page++;

      if (page > 50) {
        console.log('Limite de páginas atingido');
        break;
      }
    }

    console.log(`Total de pedidos: ${allOrders.length}`);

    // Sample 5 orders for debugging - show their structure
    if (debug && allOrders.length > 0) {
      console.log('=== DEBUG: Amostra de pedidos ===');
      for (let i = 0; i < Math.min(5, allOrders.length); i++) {
        const o = allOrders[i];
        console.log(`Pedido ${o.numero}: loja=${JSON.stringify(o.loja)}, origem=${JSON.stringify(o.origem)}, canal=${o.canal}, numeroPedidoLoja=${o.numeroPedidoLoja}`);
      }
    }

    // Filter orders by marketplace
    const marketplaceOrders: any[] = [];
    let debugCount = 0;
    
    for (const order of allOrders) {
      // Debug first 10 orders to see structure
      const shouldDebug = debug && debugCount < 10;
      const detectedMarketplace = detectMarketplace(order, shouldDebug);
      if (shouldDebug) debugCount++;
      
      if (detectedMarketplace) {
        // If marketplace filter is specified, only include matching orders
        if (marketplace && detectedMarketplace !== marketplace.toUpperCase()) {
          continue;
        }
        
        marketplaceOrders.push({
          ...order,
          detected_marketplace: detectedMarketplace,
        });
      }
    }

    console.log(`Pedidos de marketplaces encontrados: ${marketplaceOrders.length}`);
    
    // Log breakdown by marketplace
    const byMarketplace: Record<string, number> = {};
    for (const o of marketplaceOrders) {
      byMarketplace[o.detected_marketplace] = (byMarketplace[o.detected_marketplace] || 0) + 1;
    }
    console.log('Breakdown por marketplace:', JSON.stringify(byMarketplace));

    // Upsert orders into database
    let syncedCount = 0;
    
    for (const order of marketplaceOrders) {
      // Rate limit delay every 5 orders
      if (syncedCount > 0 && syncedCount % 5 === 0) {
        await delay(100);
      }

      const orderData = {
        bling_order_id: order.id,
        marketplace: order.detected_marketplace,
        order_number: order.numero || String(order.id),
        order_date: order.data ? new Date(order.data).toISOString() : null,
        customer_name: order.contato?.nome || null,
        customer_email: order.contato?.email || null,
        customer_document: order.contato?.numeroDocumento || null,
        valor_total: Number(order.total || order.totalProdutos || 0),
        valor_frete: Number(order.transporte?.frete || 0),
        status_pagamento: mapBlingStatusToLocal(order.situacao),
        status_logistico: order.transporte?.etiqueta?.situacao || null,
        codigo_rastreio: order.transporte?.codigoRastreamento || null,
        url_rastreio: order.transporte?.urlRastreamento || null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('bling_marketplace_pedidos')
        .upsert(orderData, { 
          onConflict: 'bling_order_id',
        });

      if (upsertError) {
        console.error(`Erro ao salvar pedido ${order.id}:`, upsertError);
      } else {
        syncedCount++;
      }
    }

    console.log(`Sincronização concluída! ${syncedCount} pedidos salvos.`);

    // Get summary by marketplace
    const { data: summary } = await supabase
      .from('bling_marketplace_pedidos')
      .select('marketplace')
      .then((res: any) => {
        if (res.error) return { data: null };
        const counts: Record<string, number> = {};
        for (const row of res.data || []) {
          counts[row.marketplace] = (counts[row.marketplace] || 0) + 1;
        }
        return { data: counts };
      });

    return new Response(JSON.stringify({
      success: true,
      totalOrders: allOrders.length,
      marketplaceOrders: marketplaceOrders.length,
      syncedCount,
      byMarketplace,
      summary,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({
      success: false,
      error: message,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
