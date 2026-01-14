import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONSTANTES PARA NF-e DA PENHA
// ============================================================================
const LOJA_PENHA_ID = 205891152; // ID da loja POLO PENHA no Bling
const SERIE_PENHA = 1; // Série 1 para notas da Penha

// Naturezas de operação específicas da Penha
const NATUREZA_PENHA_PF_ID = 15108893128; // PENHA - Venda mercadoria PF
const NATUREZA_PENHA_PJ_ID = 15108893188; // PENHA - Venda mercadoria PJ

// Configuração padrão (RJ/Matriz)
const SERIE_RJ = 15; // Série padrão RJ
const NATUREZA_RJ_PF_ID = 15105968428;
const NATUREZA_RJ_PJ_ID = 15105968470;

// ============================================================================
// FUNÇÃO DE TESTE - Não cria NF-e de verdade, apenas valida a lógica
// ============================================================================

interface TestResult {
  pedido_id: number;
  loja_id: number | null;
  loja_descricao: string | null;
  is_penha: boolean;
  serie_calculada: number;
  natureza_id_calculada: number;
  natureza_tipo: string;
  tipo_pessoa: string;
  cliente_doc: string | null;
  cliente_nome: string | null;
  total_itens: number;
  payload_simulado: any;
  validacao: {
    serie_correta: boolean;
    natureza_correta: boolean;
    mensagem: string;
  };
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[TEST-NFE-PENHA] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResponse = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  await supabase
    .from(tableName)
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bling_order_id } = await req.json();

    if (!bling_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'bling_order_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const orderId = typeof bling_order_id === 'string' 
      ? parseInt(bling_order_id, 10) 
      : bling_order_id;

    console.log(`[TEST-NFE-PENHA] ===== TESTE DE GERAÇÃO NF-e para pedido: ${orderId} =====`);
    console.log(`[TEST-NFE-PENHA] ⚠️ MODO TESTE - NÃO CRIA NF-e REAL`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar config do Bling
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Bling não encontrada' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = blingConfig.access_token;

    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(
        supabase, 
        blingConfig, 
        'bling_config',
        blingConfig.client_id!,
        blingConfig.client_secret!
      );
    }

    // Buscar dados do pedido no Bling
    console.log(`[TEST-NFE-PENHA] Buscando pedido ${orderId} no Bling...`);
    
    const checkPedidoUrl = `https://api.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
    const checkPedidoResp = await fetch(checkPedidoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!checkPedidoResp.ok) {
      const checkError = await checkPedidoResp.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: false,
          error: `Pedido #${orderId} não encontrado no Bling`,
          raw: checkError,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pedidoData = await checkPedidoResp.json();
    const pedido = pedidoData?.data;

    // =========================================================================
    // LÓGICA DE DETECÇÃO PENHA
    // =========================================================================
    const lojaId = pedido?.loja?.id;
    const lojaDescricao = pedido?.loja?.descricao || '';
    
    // Detectar se é pedido da Penha
    const isLojaPenha = lojaId === LOJA_PENHA_ID || 
                        lojaDescricao.toLowerCase().includes('penha');

    console.log(`[TEST-NFE-PENHA] Loja ID: ${lojaId}`);
    console.log(`[TEST-NFE-PENHA] Loja Descrição: ${lojaDescricao}`);
    console.log(`[TEST-NFE-PENHA] É PENHA? ${isLojaPenha ? '✅ SIM' : '❌ NÃO'}`);

    // Determinar tipo de pessoa
    const contato = pedido.contato;
    const numeroDoc = contato?.numeroDocumento?.replace(/\D/g, '') || '';
    const tipoPessoa = numeroDoc.length > 11 ? 'J' : 'F';

    console.log(`[TEST-NFE-PENHA] Documento: ${numeroDoc} (${numeroDoc.length} dígitos)`);
    console.log(`[TEST-NFE-PENHA] Tipo Pessoa: ${tipoPessoa === 'J' ? 'Jurídica (PJ)' : 'Física (PF)'}`);

    // =========================================================================
    // CÁLCULO DOS PARÂMETROS
    // =========================================================================
    let serieCalculada: number;
    let naturezaIdCalculada: number;
    let naturezaTipo: string;

    if (isLojaPenha) {
      serieCalculada = SERIE_PENHA;
      naturezaIdCalculada = tipoPessoa === 'J' ? NATUREZA_PENHA_PJ_ID : NATUREZA_PENHA_PF_ID;
      naturezaTipo = tipoPessoa === 'J' ? 'PENHA - Venda mercadoria PJ' : 'PENHA - Venda mercadoria PF';
    } else {
      serieCalculada = SERIE_RJ;
      naturezaIdCalculada = tipoPessoa === 'J' ? NATUREZA_RJ_PJ_ID : NATUREZA_RJ_PF_ID;
      naturezaTipo = tipoPessoa === 'J' ? 'RJ - Venda mercadoria PJ' : 'RJ - Venda mercadoria PF';
    }

    console.log(`[TEST-NFE-PENHA] Série calculada: ${serieCalculada}`);
    console.log(`[TEST-NFE-PENHA] Natureza ID calculada: ${naturezaIdCalculada}`);
    console.log(`[TEST-NFE-PENHA] Natureza tipo: ${naturezaTipo}`);

    // =========================================================================
    // SIMULAR PAYLOAD DA NF-e
    // =========================================================================
    const hoje = new Date().toISOString().split('T')[0];
    
    const payloadSimulado: any = {
      tipo: 1,
      dataOperacao: hoje,
      dataEmissao: hoje,
      serie: isLojaPenha ? SERIE_PENHA : undefined, // 🔑 SÉRIE EXPLÍCITA PARA PENHA
      contato: {
        id: contato?.id,
        nome: contato?.nome,
        numeroDocumento: contato?.numeroDocumento,
        tipoPessoa: tipoPessoa,
      },
      itens: (pedido.itens || []).map((item: any) => ({
        codigo: item.codigo || item.produto?.codigo,
        descricao: item.descricao || item.produto?.descricao,
        quantidade: item.quantidade,
        valor: item.valor,
      })),
      idPedidoVenda: orderId,
      naturezaOperacao: { id: naturezaIdCalculada }, // 🔑 NATUREZA EXPLÍCITA
    };

    // Adicionar loja se existir
    if (pedido.loja?.id) {
      payloadSimulado.loja = { 
        id: pedido.loja.id,
        ...(pedido.loja?.unidadeNegocio?.id && {
          unidadeNegocio: { id: pedido.loja.unidadeNegocio.id }
        })
      };
    }

    // =========================================================================
    // VALIDAÇÃO
    // =========================================================================
    const validacao = {
      serie_correta: isLojaPenha ? serieCalculada === 1 : true,
      natureza_correta: naturezaIdCalculada > 0,
      mensagem: '',
    };

    if (isLojaPenha) {
      if (serieCalculada === 1 && naturezaIdCalculada === (tipoPessoa === 'J' ? NATUREZA_PENHA_PJ_ID : NATUREZA_PENHA_PF_ID)) {
        validacao.mensagem = '✅ VALIDAÇÃO OK: Pedido da PENHA será emitido com Série 1 e Natureza correta';
      } else {
        validacao.mensagem = '❌ ERRO: Parâmetros incorretos para pedido da Penha';
      }
    } else {
      validacao.mensagem = '⚠️ Pedido NÃO é da Penha - usará configuração padrão RJ';
    }

    console.log(`[TEST-NFE-PENHA] ${validacao.mensagem}`);

    // =========================================================================
    // RESULTADO DO TESTE
    // =========================================================================
    const result: TestResult = {
      pedido_id: orderId,
      loja_id: lojaId,
      loja_descricao: lojaDescricao,
      is_penha: isLojaPenha,
      serie_calculada: serieCalculada,
      natureza_id_calculada: naturezaIdCalculada,
      natureza_tipo: naturezaTipo,
      tipo_pessoa: tipoPessoa === 'J' ? 'Jurídica (PJ)' : 'Física (PF)',
      cliente_doc: contato?.numeroDocumento,
      cliente_nome: contato?.nome,
      total_itens: pedido.itens?.length || 0,
      payload_simulado: payloadSimulado,
      validacao,
    };

    console.log(`[TEST-NFE-PENHA] ===== TESTE CONCLUÍDO =====`);
    console.log(JSON.stringify(result, null, 2));

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'TEST',
        message: '⚠️ MODO TESTE - Nenhuma NF-e foi criada. Apenas validação de parâmetros.',
        result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[TEST-NFE-PENHA] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
