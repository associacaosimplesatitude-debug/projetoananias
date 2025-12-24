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

// Known marketplace loja IDs from Bling integrations
// These are populated dynamically based on the detected lojas
const MARKETPLACE_LOJA_IDS: Record<number, string> = {};

function detectMarketplace(order: any, lojaIdMapping: Map<number, string>): string | null {
  // Collect all fields to check
  const lojaDescricao = (order.loja?.descricao || '').toLowerCase().trim();
  const lojaNome = (order.loja?.nome || '').toLowerCase().trim();
  const lojaId = order.loja?.id;
  const canal = (order.canal || '').toLowerCase();
  const origemDescricao = (order.origem?.descricao || '').toLowerCase();
  const origemNome = (order.origem?.nome || '').toLowerCase();
  const numeroPedidoLoja = (order.numeroPedidoLoja || '').toString();
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
  
  // Check for ECG prefixed names (common in Bling for marketplace integrations)
  // Pattern: "ECG Shopee", "ECG Mercado Livre", "ECG Amazon", etc.
  
  // Shopee detection
  if (lojaDescricao.includes('shopee') || lojaNome.includes('shopee') || 
      vendedorDescricao.includes('shopee') || vendedorNome.includes('shopee') ||
      allText.includes('shopee')) {
    return 'SHOPEE';
  }
  
  // Amazon detection
  if (lojaDescricao.includes('amazon') || lojaNome.includes('amazon') ||
      vendedorDescricao.includes('amazon') || vendedorNome.includes('amazon') ||
      allText.includes('amazon') || allText.includes('amzn')) {
    return 'AMAZON';
  }
  
  // Mercado Livre detection
  if (lojaDescricao.includes('mercado') || lojaNome.includes('mercado') ||
      lojaDescricao.includes('meli') || lojaNome.includes('meli') ||
      vendedorDescricao.includes('mercado') || vendedorNome.includes('mercado') ||
      allText.includes('mercado livre') || allText.includes('mercadolivre') ||
      allText.includes('meli') || allText.includes('ml ')) {
    return 'MERCADO_LIVRE';
  }
  
  // Check by order number patterns (less reliable)
  if (numeroPedidoLoja) {
    // Shopee: long numeric (15+ digits)
    if (/^\d{15,}$/.test(numeroPedidoLoja)) {
      return 'SHOPEE';
    }
    // Amazon: XXX-XXXXXXX-XXXXXXX format
    if (/^\d{3}-\d{7}-\d{7}$/.test(numeroPedidoLoja)) {
      return 'AMAZON';
    }
    // Mercado Livre: 10-12 digits
    if (/^\d{10,12}$/.test(numeroPedidoLoja)) {
      return 'MERCADO_LIVRE';
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

    // FIRST PASS: Analyze all unique lojas to build marketplace mapping
    const lojaAnalysis = new Map<number, { descricao: string; count: number }>();
    
    for (const order of allOrders) {
      if (order.loja?.id) {
        const existing = lojaAnalysis.get(order.loja.id);
        if (existing) {
          existing.count++;
        } else {
          lojaAnalysis.set(order.loja.id, {
            descricao: order.loja.descricao || order.loja.nome || '',
            count: 1
          });
        }
      }
    }
    
    // Log all lojas found
    console.log('=== Lojas encontradas no Bling ===');
    for (const [lojaId, info] of lojaAnalysis.entries()) {
      console.log(`  Loja ID ${lojaId}: "${info.descricao}" (${info.count} pedidos)`);
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
      } else if (desc.includes('mercado') || desc.includes('meli') || desc.includes('ml')) {
        lojaIdMapping.set(lojaId, 'MERCADO_LIVRE');
        console.log(`  -> Loja ${lojaId} mapeada para MERCADO_LIVRE`);
      }
    }

    // Show sample orders for debugging
    if (debug && allOrders.length > 0) {
      console.log('=== DEBUG: Amostra de pedidos ===');
      for (let i = 0; i < Math.min(5, allOrders.length); i++) {
        const o = allOrders[i];
        console.log(`[SAMPLE] Pedido ${o.numero}:`);
        console.log(`  loja: ${JSON.stringify(o.loja)}`);
        console.log(`  vendedor: ${JSON.stringify(o.vendedor)}`);
        console.log(`  origem: ${JSON.stringify(o.origem)}`);
        console.log(`  canal: ${o.canal}`);
        console.log(`  numeroPedidoLoja: ${o.numeroPedidoLoja}`);
      }
    }

    // SECOND PASS: Filter orders by marketplace
    const marketplaceOrders: any[] = [];
    
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
        console.error(`Erro ao salvar pedido ${order.id}:`, upsertError);
      } else {
        syncedCount++;
      }
    }

    console.log(`Sincronização concluída! ${syncedCount} pedidos salvos.`);

    // Get summary by marketplace
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

    return new Response(JSON.stringify({
      success: true,
      totalOrders: allOrders.length,
      marketplaceOrders: marketplaceOrders.length,
      syncedCount,
      byMarketplace,
      summary,
      lojasEncontradas: Object.fromEntries(lojaAnalysis),
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
