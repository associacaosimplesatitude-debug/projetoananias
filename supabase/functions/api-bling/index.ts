// v1.0.0 - Consolidação Bling - 2026-02-06
// Núcleo unificado para todas as operações Bling:
// - CREATE_ORDER (ex bling-create-order)
// - GENERATE_NFE (ex bling-generate-nfe)
// - CHECK_STOCK (ex bling-check-stock)
// - SYNC_ORDER_STATUS (ex bling-sync-order-status)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ========== HELPERS COMPARTILHADOS ==========

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[API-BLING] [${tableName}] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
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
    console.error(`[API-BLING] [${tableName}] Erro ao renovar token:`, tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from(tableName)
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error(`[API-BLING] [${tableName}] Erro ao salvar tokens:`, updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log(`[API-BLING] [${tableName}] Token renovado com sucesso! Expira em:`, expiresAt.toISOString());
  return tokenData.access_token;
}

// Função para verificar se o token está expirado
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Helper para extrair mensagem de erro fiscal do Bling
function extractFiscalError(data: any): string | null {
  if (!data) return null;
  
  if (data.error?.fields) {
    if (Array.isArray(data.error.fields) && data.error.fields.length > 0) {
      const fieldMsgs = data.error.fields
        .map((f: any) => f?.msg || f?.message || f?.mensagem)
        .filter(Boolean);
      if (fieldMsgs.length > 0) {
        return fieldMsgs.join(' | ');
      }
    }
    if (typeof data.error.fields === 'object' && !Array.isArray(data.error.fields)) {
      const fieldErrors = Object.entries(data.error.fields)
        .map(([field, msg]) => typeof msg === 'string' ? msg : (msg as any)?.msg || (msg as any)?.message)
        .filter(Boolean)
        .join('; ');
      if (fieldErrors) {
        return fieldErrors;
      }
    }
  }
  
  if (data.error?.message) return data.error.message;
  if (data.error?.description) return data.error.description;
  if (data.message) return data.message;
  if (data.mensagem) return data.mensagem;
  
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message || e.mensagem || e.msg || JSON.stringify(e)).join('; ');
  }
  
  return null;
}

// Obter configuração e token do Bling
async function getBlingConfig(supabase: any): Promise<{ config: any; accessToken: string; tableName: string }> {
  const { data: config, error: configError } = await supabase
    .from('bling_config')
    .select('*')
    .single();

  if (configError || !config) {
    throw new Error('Configuração do Bling não encontrada');
  }

  let accessToken = config.access_token;
  const tableName = 'bling_config';

  if (isTokenExpired(config.token_expires_at)) {
    console.log('[API-BLING] Token expirado, renovando...');
    accessToken = await refreshBlingToken(supabase, config, tableName, config.client_id!, config.client_secret!);
  }

  return { config, accessToken, tableName };
}

// ========== HANDLER: CHECK_STOCK ==========
async function handleCheckStock(payload: any, supabase: any): Promise<Response> {
  console.log('[API-BLING] CHECK_STOCK iniciado');
  
  try {
    const produtos = payload.produtos || (payload.produto_id ? [{ bling_produto_id: payload.produto_id, quantidade: 1 }] : null);

    if (!produtos || produtos.length === 0) {
      throw new Error('produtos ou produto_id é obrigatório');
    }

    const { accessToken } = await getBlingConfig(supabase);

    // Filtrar produtos com bling_produto_id válido
    const produtosValidos = produtos.filter((p: any) => p.bling_produto_id && p.bling_produto_id > 0);
    
    if (produtosValidos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          estoqueDisponivel: true,
          produtos: [],
          message: 'Nenhum produto com ID Bling válido para verificar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resultados = [];
    
    for (const produto of produtosValidos) {
      const produtoId = produto.bling_produto_id;
      const quantidadeSolicitada = produto.quantidade || 1;
      
      console.log(`[API-BLING] Verificando estoque do produto ID: ${produtoId}`);
      
      const productResponse = await fetch(
        `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );
      
      if (!productResponse.ok) {
        console.error(`[API-BLING] Produto ${produtoId} não encontrado no Bling:`, productResponse.status);
        resultados.push({
          bling_produto_id: produtoId,
          titulo: produto.titulo || '',
          estoque_disponivel: 0,
          quantidade_solicitada: quantidadeSolicitada,
          tem_estoque: false,
          erro: 'Produto não encontrado no Bling'
        });
        continue;
      }
      
      const productData = await productResponse.json();
      console.log(`[API-BLING] Produto encontrado: ${productData.data?.nome || 'sem nome'}`);
      
      const stockResponse = await fetch(
        `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        }
      );

      let estoqueTotal = 0;

      if (!stockResponse.ok) {
        const estoqueFromProduct = productData.data?.estoque?.saldoVirtualTotal || 0;
        console.log(`[API-BLING] Usando estoque do produto: ${estoqueFromProduct}`);
        estoqueTotal = estoqueFromProduct;
      } else {
        const stockData = await stockResponse.json();
        const estoques = stockData.data || [];
        
        for (const item of estoques) {
          if (item.produto?.id === produtoId || item.produto?.id === Number(produtoId)) {
            if (item.saldos && Array.isArray(item.saldos)) {
              for (const saldo of item.saldos) {
                estoqueTotal += (saldo.saldoFisicoTotal || 0);
              }
            }
          }
        }
        
        if (estoqueTotal === 0 && productData.data?.estoque) {
          estoqueTotal = productData.data.estoque.saldoVirtualTotal || 
                         productData.data.estoque.saldoFisicoTotal || 0;
        }
      }
      
      console.log(`[API-BLING] Produto ${produtoId}: estoque=${estoqueTotal}, solicitado=${quantidadeSolicitada}`);
      
      resultados.push({
        bling_produto_id: produtoId,
        titulo: produto.titulo || productData.data?.nome || '',
        estoque_disponivel: estoqueTotal,
        quantidade_solicitada: quantidadeSolicitada,
        tem_estoque: estoqueTotal >= quantidadeSolicitada,
      });
    }

    const todosTemEstoque = resultados.every((r: any) => r.tem_estoque);
    const produtosSemEstoque = resultados.filter((r: any) => !r.tem_estoque);

    console.log(`[API-BLING] CHECK_STOCK resultado: todosTemEstoque=${todosTemEstoque}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        estoqueDisponivel: todosTemEstoque,
        produtos: resultados,
        produtosSemEstoque: produtosSemEstoque,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[API-BLING] CHECK_STOCK erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== HANDLER: SYNC_ORDER_STATUS ==========
async function handleSyncOrderStatus(payload: any, supabase: any): Promise<Response> {
  console.log('[API-BLING] SYNC_ORDER_STATUS iniciado');
  const startTime = Date.now();

  try {
    const { accessToken } = await getBlingConfig(supabase);

    const limitParam = payload.limit || 50;
    const forceSync = payload.force === true;

    // Buscar propostas com bling_order_id que precisam de sync
    const syncThreshold = new Date();
    syncThreshold.setMinutes(syncThreshold.getMinutes() - 30);

    let query = supabase
      .from('vendedor_propostas')
      .select('id, bling_order_id, bling_order_number, status, bling_status, bling_synced_at, cliente_nome')
      .not('bling_order_id', 'is', null)
      .order('bling_synced_at', { ascending: true, nullsFirst: true })
      .limit(limitParam);

    if (!forceSync) {
      query = query.or(`bling_synced_at.is.null,bling_synced_at.lt.${syncThreshold.toISOString()}`);
    }

    const { data: propostas, error: propostasError } = await query;

    if (propostasError) {
      throw new Error('Erro ao buscar propostas para sincronização');
    }

    if (!propostas || propostas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma proposta para sincronizar', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[API-BLING] Encontradas ${propostas.length} propostas para sincronizar`);

    const results: { id: string; success: boolean; status?: string | null; error?: string }[] = [];
    const pedidosAtendidos: number[] = [];

    for (const proposta of propostas) {
      try {
        const blingOrderId = proposta.bling_order_id as number;
        console.log(`[API-BLING] Sincronizando proposta ${proposta.id} (Bling #${blingOrderId})`);

        const url = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (response.status === 404) {
          await supabase
            .from('vendedor_propostas')
            .update({ bling_synced_at: new Date().toISOString() })
            .eq('id', proposta.id);
          
          results.push({ id: proposta.id, success: true, status: 'NOT_FOUND' });
          continue;
        }

        if (response.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        if (!response.ok) {
          results.push({ id: proposta.id, success: false, error: `HTTP ${response.status}` });
          continue;
        }

        const data = await response.json();
        const blingOrder = data?.data || null;

        if (!blingOrder) {
          results.push({ id: proposta.id, success: true, status: 'NOT_FOUND' });
          continue;
        }

        const situacao = blingOrder.situacao as { id?: number; valor?: string } | undefined;
        const blingStatusId = situacao?.id || null;
        const blingStatusNome = situacao?.valor || null;

        const updateData: Record<string, unknown> = {
          bling_status: blingStatusNome,
          bling_status_id: blingStatusId,
          bling_synced_at: new Date().toISOString(),
        };

        if (blingStatusId === 34 && proposta.status !== 'CANCELADA') {
          updateData.status = 'CANCELADA';
        }

        if (blingStatusId === 31 && proposta.status !== 'FATURADO_ENTREGUE') {
          updateData.status = 'FATURADO_ENTREGUE';
          pedidosAtendidos.push(blingOrderId);
        }

        await supabase
          .from('vendedor_propostas')
          .update(updateData)
          .eq('id', proposta.id);

        results.push({ id: proposta.id, success: true, status: blingStatusNome });
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        results.push({ 
          id: proposta.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(`[API-BLING] SYNC_ORDER_STATUS concluído: ${successCount} sucesso, ${failCount} falhas (${duration}ms)`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: failCount,
        nfe_triggered: pedidosAtendidos.length,
        duration_ms: duration,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[API-BLING] SYNC_ORDER_STATUS erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== HANDLER: CREATE_ORDER (STUB - Chama função original) ==========
// NOTA: A lógica completa de bling-create-order tem ~2850 linhas.
// Para manter a função consolidada gerenciável, delegamos para a função original por enquanto.
// Em uma fase futura, toda a lógica pode ser embarcada aqui.
async function handleCreateOrder(payload: any, supabase: any): Promise<Response> {
  console.log('[API-BLING] CREATE_ORDER iniciado - delegando para bling-create-order');
  
  try {
    // Chamar a função original diretamente via HTTP
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[API-BLING] CREATE_ORDER erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao criar pedido' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== HANDLER: GENERATE_NFE (STUB - Chama função original) ==========
async function handleGenerateNfe(payload: any, supabase: any): Promise<Response> {
  console.log('[API-BLING] GENERATE_NFE iniciado - delegando para bling-generate-nfe');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const response = await fetch(`${supabaseUrl}/functions/v1/bling-generate-nfe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('[API-BLING] GENERATE_NFE erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao gerar NF-e' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ========== MAIN HANDLER ==========
serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, payload } = body;

    console.log(`[API-BLING] Ação recebida: ${action}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Roteamento por ação
    switch (action) {
      case 'CHECK_STOCK':
        return await handleCheckStock(payload || body, supabase);
      
      case 'SYNC_ORDER_STATUS':
        return await handleSyncOrderStatus(payload || body, supabase);
      
      case 'CREATE_ORDER':
        return await handleCreateOrder(payload || body, supabase);
      
      case 'GENERATE_NFE':
        return await handleGenerateNfe(payload || body, supabase);
      
      default:
        console.error(`[API-BLING] Ação inválida: ${action}`);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Ação inválida: ${action}. Ações válidas: CHECK_STOCK, SYNC_ORDER_STATUS, CREATE_ORDER, GENERATE_NFE` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

  } catch (error) {
    console.error('[API-BLING] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
