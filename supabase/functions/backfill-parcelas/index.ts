import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] backfill-parcelas iniciado`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let totalPropostas = 0;
    let totalMercadoPago = 0;
    let totalShopify = 0;
    let parcelasCriadas = 0;

    // 1. Buscar todas as propostas FATURADAS que ainda não têm parcelas
    const { data: propostas, error: propostasError } = await supabase
      .from('vendedor_propostas')
      .select(`
        id,
        vendedor_id,
        cliente_id,
        valor_total,
        prazo_faturamento_selecionado,
        created_at
      `)
      .eq('status', 'FATURADO')
      .not('vendedor_id', 'is', null);

    if (propostasError) {
      throw new Error(`Erro ao buscar propostas: ${propostasError.message}`);
    }

    console.log(`[${requestId}] Propostas faturadas encontradas: ${propostas?.length || 0}`);

    // 2. Buscar propostas que já têm parcelas para evitar duplicatas
    const { data: parcelasExistentes } = await supabase
      .from('vendedor_propostas_parcelas')
      .select('proposta_id')
      .not('proposta_id', 'is', null);

    const propostasComParcelas = new Set(parcelasExistentes?.map(p => p.proposta_id) || []);
    console.log(`[${requestId}] Propostas já com parcelas: ${propostasComParcelas.size}`);

    // 3. Buscar comissões dos vendedores
    const { data: vendedores } = await supabase
      .from('vendedores')
      .select('id, comissao_percentual');

    const vendedorComissao: { [key: string]: number } = {};
    vendedores?.forEach(v => {
      vendedorComissao[v.id] = v.comissao_percentual || 1.5;
    });

    // 4. Processar propostas sem parcelas
    const parcelasConfig: { [key: string]: number[] } = {
      '30': [30],
      '60_direto': [60],
      '60': [30, 60],
      '60_90': [60, 90],
      '90': [30, 60, 90],
    };

    const parcelasToInsert: any[] = [];

    // Helper: Calcula data de liberação (dia 05 do mês seguinte)
    const calcularDataLiberacao = (dataPedido: Date): string => {
      const dataLiberacao = new Date(dataPedido);
      dataLiberacao.setMonth(dataLiberacao.getMonth() + 1);
      dataLiberacao.setDate(5);
      return dataLiberacao.toISOString().split('T')[0];
    };

    // Helper: Verifica se já passou o dia 05 do mês seguinte
    const jaPassouDiaLiberacao = (dataPedido: Date): boolean => {
      const hoje = new Date();
      const dataLiberacao = new Date(dataPedido);
      dataLiberacao.setMonth(dataLiberacao.getMonth() + 1);
      dataLiberacao.setDate(5);
      return hoje >= dataLiberacao;
    };

    for (const proposta of (propostas || [])) {
      if (propostasComParcelas.has(proposta.id)) continue;
      if (!proposta.vendedor_id) continue;

      totalPropostas++;
      const prazo = proposta.prazo_faturamento_selecionado || '30';
      const diasParcelas = parcelasConfig[prazo] || [30];
      const valorTotal = proposta.valor_total || 0;
      const valorPorParcela = Math.round((valorTotal / diasParcelas.length) * 100) / 100;
      const comissaoPercentual = vendedorComissao[proposta.vendedor_id] || 1.5;
      const comissaoPorParcela = Math.round((valorPorParcela * (comissaoPercentual / 100)) * 100) / 100;
      const dataFaturamento = new Date(proposta.created_at);

      diasParcelas.forEach((dias, index) => {
        const dataVencimento = new Date(dataFaturamento);
        dataVencimento.setDate(dataVencimento.getDate() + dias);
        const hoje = new Date();
        const vencida = dataVencimento < hoje;

        parcelasToInsert.push({
          proposta_id: proposta.id,
          vendedor_id: proposta.vendedor_id,
          cliente_id: proposta.cliente_id,
          numero_parcela: index + 1,
          total_parcelas: diasParcelas.length,
          valor: valorPorParcela,
          valor_comissao: comissaoPorParcela,
          data_vencimento: dataVencimento.toISOString().split('T')[0],
          status: vencida ? 'atrasada' : 'aguardando',
          origem: 'faturado',
        });
        parcelasCriadas++;
      });
    }

    // 5. Buscar pedidos Mercado Pago PAGOS sem parcelas
    const { data: pedidosMP, error: pedidosMPError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .select(`
        id,
        vendedor_id,
        cliente_id,
        valor_total,
        created_at
      `)
      .eq('status', 'PAGO')
      .not('vendedor_id', 'is', null);

    if (pedidosMPError) {
      console.error(`[${requestId}] Erro ao buscar pedidos MP:`, pedidosMPError);
    }

    console.log(`[${requestId}] Pedidos Mercado Pago pagos encontrados: ${pedidosMP?.length || 0}`);

    // Verificar quais já têm parcelas (por origem mercadopago)
    const { data: parcelasMPExistentes } = await supabase
      .from('vendedor_propostas_parcelas')
      .select('cliente_id, valor, data_vencimento')
      .eq('origem', 'mercadopago');

    // Criar Set de chaves únicas para evitar duplicatas
    const parcelasMPSet = new Set(
      parcelasMPExistentes?.map(p => `${p.cliente_id}-${p.valor}-${p.data_vencimento}`) || []
    );

    for (const pedido of (pedidosMP || [])) {
      if (!pedido.vendedor_id) continue;

      const valorTotal = pedido.valor_total || 0;
      const dataPagamento = new Date(pedido.created_at).toISOString().split('T')[0];
      const chave = `${pedido.cliente_id}-${valorTotal}-${dataPagamento}`;

      if (parcelasMPSet.has(chave)) continue;

      totalMercadoPago++;
      const comissaoPercentual = vendedorComissao[pedido.vendedor_id] || 1.5;
      const valorComissao = Math.round((valorTotal * (comissaoPercentual / 100)) * 100) / 100;
      const dataPedido = new Date(pedido.created_at);
      const jaLiberada = jaPassouDiaLiberacao(dataPedido);

      parcelasToInsert.push({
        proposta_id: null,
        vendedor_id: pedido.vendedor_id,
        cliente_id: pedido.cliente_id,
        numero_parcela: 1,
        total_parcelas: 1,
        valor: valorTotal,
        valor_comissao: valorComissao,
        data_vencimento: dataPagamento,
        data_pagamento: dataPagamento,
        status: 'paga',
        origem: 'mercadopago',
        comissao_status: jaLiberada ? 'liberada' : 'agendada',
        data_liberacao: jaLiberada ? calcularDataLiberacao(dataPedido) : null,
      });
      parcelasCriadas++;
    }

    // 6. NOVO: Buscar pedidos Shopify PAGOS sem parcelas
    const { data: pedidosShopify, error: pedidosShopifyError } = await supabase
      .from('ebd_shopify_pedidos')
      .select(`
        id,
        vendedor_id,
        cliente_id,
        valor_total,
        customer_name,
        order_number,
        created_at
      `)
      .eq('status_pagamento', 'paid')
      .is('shopify_cancelled_at', null)
      .not('vendedor_id', 'is', null);

    if (pedidosShopifyError) {
      console.error(`[${requestId}] Erro ao buscar pedidos Shopify:`, pedidosShopifyError);
    }

    console.log(`[${requestId}] Pedidos Shopify pagos encontrados: ${pedidosShopify?.length || 0}`);

    // Verificar quais já têm parcelas (por origem online - usando vendedor_id + cliente_id + valor + data)
    const { data: parcelasOnlineExistentes } = await supabase
      .from('vendedor_propostas_parcelas')
      .select('vendedor_id, cliente_id, valor, data_vencimento')
      .eq('origem', 'online');

    // Criar Set de chaves únicas para evitar duplicatas (mesma lógica do mercadopago)
    const parcelasOnlineSet = new Set(
      parcelasOnlineExistentes?.map(p => `${p.vendedor_id}-${p.cliente_id}-${p.valor}-${p.data_vencimento}`) || []
    );

    console.log(`[${requestId}] Parcelas online já existentes: ${parcelasOnlineSet.size}`);

    for (const pedido of (pedidosShopify || [])) {
      if (!pedido.vendedor_id) continue;
      
      const valorTotal = pedido.valor_total || 0;
      const dataPagamento = new Date(pedido.created_at).toISOString().split('T')[0];
      const chave = `${pedido.vendedor_id}-${pedido.cliente_id}-${valorTotal}-${dataPagamento}`;
      
      if (parcelasOnlineSet.has(chave)) continue;

      totalShopify++;
      const comissaoPercentual = vendedorComissao[pedido.vendedor_id] || 1.5;
      const valorComissao = Math.round((valorTotal * (comissaoPercentual / 100)) * 100) / 100;
      const dataPedido = new Date(pedido.created_at);
      const jaLiberada = jaPassouDiaLiberacao(dataPedido);

      parcelasToInsert.push({
        proposta_id: null, // Não usar FK para pedidos online
        vendedor_id: pedido.vendedor_id,
        cliente_id: pedido.cliente_id,
        numero_parcela: 1,
        total_parcelas: 1,
        valor: valorTotal,
        valor_comissao: valorComissao,
        data_vencimento: dataPagamento,
        data_pagamento: dataPagamento,
        status: 'paga',
        origem: 'online', // Nova origem para pedidos Shopify pagos
        comissao_status: jaLiberada ? 'liberada' : 'agendada',
        data_liberacao: jaLiberada ? calcularDataLiberacao(dataPedido) : null,
      });
      parcelasCriadas++;
    }

    // 7. Inserir todas as parcelas
    if (parcelasToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('vendedor_propostas_parcelas')
        .insert(parcelasToInsert);

      if (insertError) {
        throw new Error(`Erro ao inserir parcelas: ${insertError.message}`);
      }
    }

    console.log(`[${requestId}] ✅ Backfill concluído!`, {
      propostas_processadas: totalPropostas,
      pedidos_mp_processados: totalMercadoPago,
      pedidos_shopify_processados: totalShopify,
      parcelas_criadas: parcelasCriadas,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backfill de parcelas concluído',
        propostas_processadas: totalPropostas,
        pedidos_mp_processados: totalMercadoPago,
        pedidos_shopify_processados: totalShopify,
        parcelas_criadas: parcelasCriadas,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error(`[${requestId}] Erro:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno',
        request_id: requestId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
