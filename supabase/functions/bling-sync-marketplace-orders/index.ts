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

async function fetchBlingLojas(accessToken: string): Promise<Array<{ id: number; nome?: string; descricao?: string }>> {
  // Endpoint v3: /lojas
  const url = 'https://www.bling.com.br/Api/v3/lojas?limite=100';
  console.log(`[REQ] URL (lojas): ${url}`);

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  console.log(`[RES] lojas Status: ${res.status}`);

  if (!res.ok) {
    const body = await res.text();
    console.error(`[RES] lojas Error body: ${body}`);
    throw new Error(`Erro ao buscar lojas: ${res.status}`);
  }

  const data = await res.json();
  const lojas = (data?.data || []) as Array<{ id: number; nome?: string; descricao?: string }>;
  return lojas;
}

function normalizeLojaText(loja: { nome?: string; descricao?: string } | null | undefined) {
  const nome = (loja?.nome || '').toLowerCase().trim();
  const descricao = (loja?.descricao || '').toLowerCase().trim();
  return `${nome} ${descricao}`.trim();
}

function detectMarketplace(order: any, lojaIdMapping: Map<number, string>): string | null {
  // Collect all fields to check
  const lojaId = order.loja?.id;
  const lojaDescricao = (order.loja?.descricao || '').toLowerCase().trim();
  const lojaNome = (order.loja?.nome || '').toLowerCase().trim();
  const canal = (order.canal || '').toLowerCase();
  const origemDescricao = (order.origem?.descricao || '').toLowerCase();
  const origemNome = (order.origem?.nome || '').toLowerCase();
  const numeroPedidoLoja = (order.numeroPedidoLoja || '').toString().trim();
  const observacoes = (order.observacoes || '').toLowerCase();
  const observacoesInternas = (order.observacoesInternas || '').toLowerCase();
  const vendedorDescricao = (order.vendedor?.descricao || '').toLowerCase();
  const vendedorNome = (order.vendedor?.nome || '').toLowerCase();

  // Check by loja ID first (most reliable)
  if (lojaId && lojaIdMapping.has(lojaId)) {
    return lojaIdMapping.get(lojaId)!;
  }

  // Combine all text fields to search
  const allText = `${lojaDescricao} ${lojaNome} ${canal} ${origemDescricao} ${origemNome} ${observacoes} ${observacoesInternas} ${vendedorDescricao} ${vendedorNome}`;

  // Shopee detection
  if (
    lojaDescricao.includes('shopee') ||
    lojaNome.includes('shopee') ||
    vendedorDescricao.includes('shopee') ||
    vendedorNome.includes('shopee') ||
    allText.includes('shopee') ||
    allText.includes('ecg shopee')
  ) {
    return 'SHOPEE';
  }

  // Amazon detection
  if (
    lojaDescricao.includes('amazon') ||
    lojaNome.includes('amazon') ||
    vendedorDescricao.includes('amazon') ||
    vendedorNome.includes('amazon') ||
    allText.includes('amazon') ||
    allText.includes('amzn') ||
    allText.includes('ecg amazon')
  ) {
    return 'AMAZON';
  }

  // Mercado Livre detection
  if (
    lojaDescricao.includes('mercado') ||
    lojaNome.includes('mercado') ||
    lojaDescricao.includes('meli') ||
    lojaNome.includes('meli') ||
    vendedorDescricao.includes('mercado') ||
    vendedorNome.includes('mercado') ||
    allText.includes('mercado livre') ||
    allText.includes('mercadolivre') ||
    allText.includes('meli') ||
    allText.includes('ecg mercado')
  ) {
    return 'MERCADO_LIVRE';
  }

  // Check by order number patterns (numeroPedidoLoja)
  if (numeroPedidoLoja) {
    // Mercado Livre: 16 digits starting with 2000
    if (/^2000\d{12}$/.test(numeroPedidoLoja)) {
      return 'MERCADO_LIVRE';
    }
    // Amazon: XXX-XXXXXXX-XXXXXXX
    if (/^\d{3}-\d{7}-\d{7}$/.test(numeroPedidoLoja)) {
      return 'AMAZON';
    }
    // Shopee: Starts with letters
    if (/^[A-Z]{2}\d+/.test(numeroPedidoLoja)) {
      return 'SHOPEE';
    }
  }

  return null;
}

function mapBlingStatusToLocal(situacao: any): string {
  const id = situacao?.id || situacao?.valor || 0;
  const nome = (situacao?.nome || situacao?.descricao || '').toLowerCase();
  
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

    console.log('=== INICIANDO SINCRONIZAÇÃO DE PEDIDOS BLING ===');
    console.log(`Marketplace solicitado: ${marketplace || 'TODOS'}`);
    console.log(`Debug mode: ${debug ? 'SIM' : 'NÃO'}`);

    const requestedMarketplace = marketplace ? String(marketplace).toUpperCase() : null;

    // Build date filter (last 90 days)
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 90);
    const dataInicialStr = dataInicial.toISOString().split('T')[0];

    // Fetch lojas once so we can map loja.id -> descrição (Bling nem sempre devolve descricao dentro do pedido)
    const lojas = await fetchBlingLojas(accessToken);
    const lojaDescById = new Map<number, string>();

    console.log('=== LOJAS (API) ===');
    for (const l of lojas) {
      const text = (l.descricao || l.nome || '').trim();
      lojaDescById.set(l.id, text);
      console.log(`  Loja ID ${l.id}: "${text}"`);
    }

    // Optional: when marketplace is requested, try to filter by idLoja(s) found by loja name
    const marketplaceTargetLojaIds: number[] = [];
    if (requestedMarketplace) {
      for (const l of lojas) {
        const t = normalizeLojaText(l);
        if (requestedMarketplace === 'MERCADO_LIVRE' && (t.includes('mercado livre') || t.includes('mercadolivre') || t.includes('meli') || t.includes('ml') || t.includes('ecg mercado'))) {
          marketplaceTargetLojaIds.push(l.id);
        }
        if (requestedMarketplace === 'SHOPEE' && (t.includes('shopee') || t.includes('ecg shopee'))) {
          marketplaceTargetLojaIds.push(l.id);
        }
        if (requestedMarketplace === 'AMAZON' && (t.includes('amazon') || t.includes('amzn') || t.includes('ecg amazon'))) {
          marketplaceTargetLojaIds.push(l.id);
        }
      }
      if (marketplaceTargetLojaIds.length) {
        console.log(`Filtrando por idLoja para ${requestedMarketplace}: ${marketplaceTargetLojaIds.join(', ')}`);
      } else {
        console.log(`Nenhuma loja encontrada por nome para ${requestedMarketplace}; buscando pedidos sem filtro de loja.`);
      }
    }

    const lojaIdsToFetch = marketplaceTargetLojaIds.length ? marketplaceTargetLojaIds : [null];

    for (const lojaId of lojaIdsToFetch) {
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        console.log(`Buscando página ${page}${lojaId ? ` (idLoja=${lojaId})` : ''}...`);

        if (page > 1) {
          await delay(400); // Rate limit: 3 req/s
        }

        const url = `https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${dataInicialStr}${lojaId ? `&idLoja=${lojaId}` : ''}`;
        console.log(`[REQ] URL: ${url}`);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        console.log(`[RES] Status: ${response.status}`);

        if (!response.ok) {
          if (response.status === 429) {
            console.log('Rate limit, aguardando 2s...');
            await delay(2000);
            continue;
          }
          const errorBody = await response.text();
          console.error(`[RES] Error body: ${errorBody}`);
          throw new Error(`Erro ao buscar pedidos: ${response.status}`);
        }

        const data = await response.json();
        const orders = data.data || [];

        console.log(`Página ${page}: ${orders.length} pedidos encontrados`);

        // Log first order structure for debugging
        if (page === 1 && allOrders.length === 0 && orders.length > 0) {
          console.log('=== ESTRUTURA DO PRIMEIRO PEDIDO (DEBUG) ===');
          console.log(JSON.stringify(orders[0], null, 2));
        }

        allOrders = [...allOrders, ...orders];

        hasMore = orders.length === 100;
        page++;

        if (page > 50) {
          console.log('Limite de páginas atingido (50)');
          hasMore = false;
        }
      }
    }

    console.log(`=== TOTAL DE PEDIDOS ENCONTRADOS: ${allOrders.length} ===`);

    // FIRST PASS: Analyze all unique lojas AND vendors to build marketplace mapping
    const lojaAnalysis = new Map<number, { descricao: string; count: number }>();
    const vendedorAnalysis = new Map<string, { descricao: string; count: number }>();
    const numeroPedidoLojaAnalysis = new Map<string, number>(); // pattern -> count
    
    for (const order of allOrders) {
      // Analyze loja
      if (order.loja?.id) {
        const existing = lojaAnalysis.get(order.loja.id);
        if (existing) {
          existing.count++;
        } else {
          lojaAnalysis.set(order.loja.id, {
            descricao: lojaDescById.get(order.loja.id) || order.loja.descricao || order.loja.nome || '',
            count: 1
          });
      }
      
      // Analyze vendedor
      if (order.vendedor?.descricao || order.vendedor?.nome) {
        const vendKey = order.vendedor.descricao || order.vendedor.nome || '';
        const existing = vendedorAnalysis.get(vendKey);
        if (existing) {
          existing.count++;
        } else {
          vendedorAnalysis.set(vendKey, {
            descricao: vendKey,
            count: 1
          });
        }
      }
      
      // Analyze numeroPedidoLoja patterns
      if (order.numeroPedidoLoja) {
        const num = String(order.numeroPedidoLoja);
        let pattern = 'unknown';
        if (/^2000\d{12}$/.test(num)) pattern = 'ML_2000xxx (16 digits)';
        else if (/^\d{10,12}$/.test(num)) pattern = 'numeric_10-12';
        else if (/^\d{13,}$/.test(num)) pattern = 'numeric_13+';
        else if (/^\d{3}-\d{7}-\d{7}$/.test(num)) pattern = 'AMAZON_XXX-XXX-XXX';
        else if (/^[A-Z]/.test(num)) pattern = 'starts_with_letter';
        
        numeroPedidoLojaAnalysis.set(pattern, (numeroPedidoLojaAnalysis.get(pattern) || 0) + 1);
      }
    }
    
    // Log all lojas found
    console.log('=== LOJAS ENCONTRADAS NO BLING ===');
    for (const [lojaId, info] of lojaAnalysis.entries()) {
      console.log(`  Loja ID ${lojaId}: "${info.descricao}" (${info.count} pedidos)`);
    }
    
    console.log('=== VENDEDORES ENCONTRADOS NO BLING ===');
    for (const [vendKey, info] of vendedorAnalysis.entries()) {
      console.log(`  Vendedor: "${info.descricao}" (${info.count} pedidos)`);
    }
    
    console.log('=== PADRÕES DE numeroPedidoLoja ===');
    for (const [pattern, count] of numeroPedidoLojaAnalysis.entries()) {
      console.log(`  Padrão "${pattern}": ${count} pedidos`);
    }
    
    // Build loja ID to marketplace mapping based on names
    const lojaIdMapping = new Map<number, string>();
    
    for (const [lojaId, info] of lojaAnalysis.entries()) {
      const desc = info.descricao.toLowerCase();
      
      if (desc.includes('shopee')) {
        lojaIdMapping.set(lojaId, 'SHOPEE');
        console.log(`  -> Loja ${lojaId} mapeada para SHOPEE`);
      } else if (desc.includes('amazon') || desc.includes('amzn')) {
        lojaIdMapping.set(lojaId, 'AMAZON');
        console.log(`  -> Loja ${lojaId} mapeada para AMAZON`);
      } else if (desc.includes('mercado') || desc.includes('meli') || desc.includes('ml') || desc.includes('ecg')) {
        lojaIdMapping.set(lojaId, 'MERCADO_LIVRE');
        console.log(`  -> Loja ${lojaId} mapeada para MERCADO_LIVRE`);
      }
    }

    // Show sample orders for debugging (always in debug mode or if marketplace detection fails)
    console.log('=== DEBUG: Amostra de pedidos ===');
    for (let i = 0; i < Math.min(5, allOrders.length); i++) {
      const o = allOrders[i];
      console.log(`[SAMPLE ${i+1}] Pedido ${o.numero || o.id}:`);
      console.log(`  loja: ${JSON.stringify(o.loja)}`);
      console.log(`  vendedor: ${JSON.stringify(o.vendedor)}`);
      console.log(`  origem: ${JSON.stringify(o.origem)}`);
      console.log(`  canal: ${o.canal}`);
      console.log(`  numeroPedidoLoja: ${o.numeroPedidoLoja}`);
      console.log(`  observacoes: ${o.observacoes?.substring(0, 100)}`);
      console.log(`  total: ${o.total || o.totalProdutos}`);
      console.log(`  data: ${o.data}`);
    }

    // SECOND PASS: Filter orders by marketplace
    const marketplaceOrders: any[] = [];
    const noMarketplaceOrders: any[] = [];
    
    for (const order of allOrders) {
      const detectedMarketplace = detectMarketplace(order, lojaIdMapping);
      
      if (detectedMarketplace) {
        // If marketplace filter is specified, only include matching orders
        if (marketplace && detectedMarketplace !== marketplace.toUpperCase()) {
          continue;
        }
        
        marketplaceOrders.push({
          ...order,
          detected_marketplace: detectedMarketplace,
        });
      } else {
        noMarketplaceOrders.push(order);
      }
    }

    console.log(`=== PEDIDOS DE MARKETPLACES DETECTADOS: ${marketplaceOrders.length} ===`);
    console.log(`=== PEDIDOS SEM MARKETPLACE: ${noMarketplaceOrders.length} ===`);
    
    // Log some non-marketplace orders to understand what we're missing
    if (noMarketplaceOrders.length > 0) {
      console.log('=== EXEMPLOS DE PEDIDOS SEM MARKETPLACE DETECTADO ===');
      for (let i = 0; i < Math.min(3, noMarketplaceOrders.length); i++) {
        const o = noMarketplaceOrders[i];
        console.log(`  Pedido ${o.numero}: loja=${JSON.stringify(o.loja)}, numeroPedidoLoja=${o.numeroPedidoLoja}`);
      }
    }
    
    // Log breakdown by marketplace
    const byMarketplace: Record<string, number> = {};
    for (const o of marketplaceOrders) {
      byMarketplace[o.detected_marketplace] = (byMarketplace[o.detected_marketplace] || 0) + 1;
    }
    console.log('=== BREAKDOWN POR MARKETPLACE ===');
    console.log(JSON.stringify(byMarketplace, null, 2));

    // Upsert orders into database
    let syncedCount = 0;
    let errorCount = 0;
    
    for (const order of marketplaceOrders) {
      // Rate limit delay every 10 orders
      if (syncedCount > 0 && syncedCount % 10 === 0) {
        await delay(50);
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
        console.error(`Erro ao salvar pedido ${order.id}:`, upsertError.message);
        errorCount++;
      } else {
        syncedCount++;
      }
    }

    console.log(`=== SINCRONIZAÇÃO CONCLUÍDA ===`);
    console.log(`  Salvos: ${syncedCount}`);
    console.log(`  Erros: ${errorCount}`);

    // Get summary by marketplace from database
    const { data: dbSummary } = await supabase
      .from('bling_marketplace_pedidos')
      .select('marketplace, valor_total');
    
    const summary: Record<string, { count: number; total: number }> = {};
    if (dbSummary) {
      for (const row of dbSummary) {
        if (!summary[row.marketplace]) {
          summary[row.marketplace] = { count: 0, total: 0 };
        }
        summary[row.marketplace].count++;
        summary[row.marketplace].total += Number(row.valor_total || 0);
      }
    }
    
    console.log('=== RESUMO NO BANCO DE DADOS ===');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify({
      success: true,
      totalOrders: allOrders.length,
      marketplaceOrders: marketplaceOrders.length,
      noMarketplaceOrders: noMarketplaceOrders.length,
      syncedCount,
      errorCount,
      byMarketplace,
      summary,
      lojasEncontradas: Object.fromEntries(lojaAnalysis),
      vendedoresEncontrados: Object.fromEntries(vendedorAnalysis),
      padroesNumeroPedido: Object.fromEntries(numeroPedidoLojaAnalysis),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('=== ERRO NA SINCRONIZAÇÃO ===');
    console.error(error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

