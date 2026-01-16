import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache para IDs de situações por nome (descoberta dinâmica)
const cachedSituacaoIdsByName = new Map<string, number>();

// Função para carregar todas as situações do módulo pedidos_venda
async function loadAllSituacoes(accessToken: string): Promise<void> {
  try {
    // 1) Buscar módulos
    const urlModulos = 'https://www.bling.com.br/Api/v3/situacoes/modulos';
    const respModulos = await fetch(urlModulos, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    const jsonModulos = await respModulos.json();
    const modulos = Array.isArray(jsonModulos?.data) ? jsonModulos.data : [];
    
    // Encontrar módulo pedidos_venda
    let moduloIdVendas: number | null = null;
    for (const m of modulos) {
      const nomeNorm = (m.nome || '').toLowerCase().trim();
      if (nomeNorm === 'pedidos_venda' || nomeNorm === 'pedidos - vendas') {
        moduloIdVendas = m.id;
        break;
      }
    }
    
    if (!moduloIdVendas) {
      console.log('[BLING] Módulo pedidos_venda não encontrado');
      return;
    }
    
    // 2) Buscar situações do módulo
    const urlSituacoes = `https://www.bling.com.br/Api/v3/situacoes?idModulo=${moduloIdVendas}`;
    const respSituacoes = await fetch(urlSituacoes, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    const jsonSituacoes = await respSituacoes.json();
    const situacoes = Array.isArray(jsonSituacoes?.data) ? jsonSituacoes.data : [];
    
    // Fazer cache de todas as situações
    for (const sit of situacoes) {
      const nomeNorm = (sit.nome || '').toLowerCase().trim();
      cachedSituacaoIdsByName.set(nomeNorm, sit.id);
      console.log(`[BLING] Situação cacheada: "${sit.nome}" (ID: ${sit.id})`);
    }
    
  } catch (error) {
    console.error('[BLING] Erro ao carregar situações:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bling_order_id, status } = await req.json();

    if (!bling_order_id) {
      throw new Error('ID do pedido no Bling é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração do Bling
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      throw new Error('Configuração do Bling não encontrada');
    }

    if (!config.access_token) {
      throw new Error('Token de acesso do Bling não configurado');
    }

    // Carregar situações dinamicamente se cache estiver vazio
    if (cachedSituacaoIdsByName.size === 0) {
      await loadAllSituacoes(config.access_token);
    }

    // Resolver ID da situação baseado no status
    let situacaoId: number | null = null;
    
    switch (status) {
      case 'cancelled':
      case 'cancelado':
        situacaoId = cachedSituacaoIdsByName.get('cancelado') || 
                     cachedSituacaoIdsByName.get('cancelada') || 
                     12;
        break;
        
      case 'approved':
      case 'paid':
      case 'em_andamento':
        situacaoId = cachedSituacaoIdsByName.get('em andamento') || 
                     cachedSituacaoIdsByName.get('aprovado') ||
                     15;
        break;
        
      case 'atendido':
        situacaoId = cachedSituacaoIdsByName.get('atendido') || 9;
        break;
        
      case 'pending':
      case 'em_aberto':
      default:
        situacaoId = cachedSituacaoIdsByName.get('em aberto') || 170694;
        break;
    }

    console.log(`[BLING] Atualizando pedido ${bling_order_id} para situação ${situacaoId} (status: ${status})`);
    console.log(`[BLING] Situações disponíveis:`, Array.from(cachedSituacaoIdsByName.entries()));

    // Atualizar status do pedido no Bling usando endpoint PATCH de situações
    // Ref: https://developer.bling.com.br/referencia#/Pedidos%20-%20Vendas/patch_pedidos_vendas__idPedidoVenda__situacoes__idSituacao_
    const updateResponse = await fetch(
      `https://www.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}/situacoes/${situacaoId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    let responseData = null;
    const contentType = updateResponse.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await updateResponse.json();
    }

    if (!updateResponse.ok) {
      console.error('[BLING] Erro ao atualizar pedido no Bling:', responseData);
      throw new Error(responseData?.error?.message || 'Erro ao atualizar pedido no Bling');
    }

    console.log('[BLING] Pedido atualizado com sucesso:', responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Status do pedido atualizado no Bling',
        bling_order_id,
        new_status: status,
        situacao_id: situacaoId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BLING] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
