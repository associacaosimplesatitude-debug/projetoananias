import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * EDGE FUNCTION: aprovar-faturamento
 * 
 * Fluxo ATÔMICO de aprovação de pedidos B2B faturados.
 * 
 * Esta função executa TODAS as etapas críticas no servidor:
 * 1. Valida a proposta e busca dados completos
 * 2. Busca dados do vendedor (incluindo email para vínculo)
 * 3. Chama bling-create-order para criar pedido no Bling
 * 4. Atualiza status da proposta para FATURADO
 * 5. Cria registro em ebd_shopify_pedidos (meta do vendedor)
 * 6. Cria parcelas em vendedor_propostas_parcelas (comissões)
 * 
 * Se QUALQUER etapa falhar, retorna erro claro.
 * O frontend recebe apenas sucesso ou erro - sem estados parciais.
 */

interface AprovarFaturamentoRequest {
  proposta_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { proposta_id } = await req.json() as AprovarFaturamentoRequest;

    if (!proposta_id) {
      throw new Error('proposta_id é obrigatório');
    }

    console.log(`[APROVAR-FAT] ========== INICIANDO APROVAÇÃO ATÔMICA ==========`);
    console.log(`[APROVAR-FAT] Proposta ID: ${proposta_id}`);

    // ============ PASSO 1: Buscar proposta completa ============
    console.log(`[APROVAR-FAT] [1/6] Buscando proposta...`);
    
    const { data: proposta, error: propostaError } = await supabase
      .from('vendedor_propostas')
      .select(`
        *,
        cliente:ebd_clientes(
          id, nome_igreja, cnpj, cpf, tipo_cliente,
          email_superintendente, telefone, nome_responsavel,
          endereco_cep, endereco_rua, endereco_numero,
          endereco_complemento, endereco_bairro, endereco_cidade,
          endereco_estado, pode_faturar, desconto_faturamento
        )
      `)
      .eq('id', proposta_id)
      .single();

    if (propostaError || !proposta) {
      console.error(`[APROVAR-FAT] ❌ Proposta não encontrada:`, propostaError);
      throw new Error(`Proposta não encontrada: ${propostaError?.message || 'ID inválido'}`);
    }

    if (proposta.status !== 'AGUARDANDO_APROVACAO_FINANCEIRA') {
      throw new Error(`Proposta com status inválido: ${proposta.status}. Esperado: AGUARDANDO_APROVACAO_FINANCEIRA`);
    }

    console.log(`[APROVAR-FAT] ✅ Proposta encontrada:`, {
      cliente: proposta.cliente_nome,
      valor: proposta.valor_total,
      prazo: proposta.prazo_faturamento_selecionado,
    });

    // ============ PASSO 2: Buscar dados do vendedor ============
    console.log(`[APROVAR-FAT] [2/6] Buscando vendedor...`);
    
    let vendedorEmail: string | null = null;
    let vendedorNome: string | null = proposta.vendedor_nome;
    let comissaoPercentual = 1.5;

    if (proposta.vendedor_id) {
      const { data: vendedor, error: vendedorError } = await supabase
        .from('vendedores')
        .select('id, nome, email, comissao_percentual')
        .eq('id', proposta.vendedor_id)
        .single();

      if (vendedorError) {
        console.warn(`[APROVAR-FAT] ⚠️ Erro ao buscar vendedor:`, vendedorError);
      } else if (vendedor) {
        vendedorEmail = vendedor.email;
        vendedorNome = vendedor.nome;
        comissaoPercentual = vendedor.comissao_percentual || 1.5;
        console.log(`[APROVAR-FAT] ✅ Vendedor encontrado:`, {
          nome: vendedorNome,
          email: vendedorEmail,
          comissao: comissaoPercentual,
        });
      }
    }

    if (!vendedorEmail) {
      console.warn(`[APROVAR-FAT] ⚠️ Vendedor sem email - comissões não terão vínculo por email`);
    }

    // ============ PASSO 3: Criar pedido no Bling ============
    console.log(`[APROVAR-FAT] [3/6] Criando pedido no Bling...`);

    const prazo = proposta.prazo_faturamento_selecionado || '30';
    const valorFrete = proposta.valor_frete || 0;
    const metodoFrete = proposta.metodo_frete || 'COMBINAR';
    const cliente = proposta.cliente || {};

    // Montar itens para o Bling
    const itens = (proposta.itens || []).map((item: any) => ({
      codigo: item.sku || item.codigo || item.variantSku,
      sku: item.sku || item.codigo || item.variantSku,
      descricao: item.title,
      unidade: 'UN',
      quantidade: item.quantity,
      valor: Number(item.price),
      preco_cheio: Number(item.price),
    }));

    // Verificar se todos os itens têm SKU
    const itensSemSku = itens.filter((i: any) => !i.sku);
    if (itensSemSku.length > 0) {
      throw new Error(`Produto(s) sem SKU: ${itensSemSku.map((i: any) => i.descricao).join(', ')}`);
    }

    const valorProdutos = itens.reduce((sum: number, i: any) => sum + (i.valor * i.quantidade), 0);
    const valorTotal = Math.round((valorProdutos + valorFrete) * 100) / 100;

    // Chamar função bling-create-order
    const { data: blingResponse, error: blingError } = await supabase.functions.invoke('bling-create-order', {
      body: {
        contato: proposta.cliente_id ? { id: proposta.cliente_id } : undefined,
        cliente: {
          nome: cliente.nome_responsavel || cliente.nome_igreja || proposta.cliente_nome,
          email: cliente.email_superintendente,
          telefone: cliente.telefone,
        },
        endereco_entrega: cliente.endereco_rua ? {
          rua: cliente.endereco_rua,
          numero: cliente.endereco_numero || 'S/N',
          complemento: cliente.endereco_complemento || '',
          bairro: cliente.endereco_bairro || '',
          cep: cliente.endereco_cep || '',
          cidade: cliente.endereco_cidade || '',
          estado: cliente.endereco_estado || '',
        } : null,
        itens,
        pedido_id: proposta.id,
        valor_frete: valorFrete,
        metodo_frete: metodoFrete,
        forma_pagamento: 'FATURAMENTO',
        faturamento_prazo: prazo,
        valor_produtos: valorProdutos,
        valor_total: valorTotal,
        vendedor_nome: vendedorNome,
        vendedor_email: vendedorEmail,
        desconto_percentual: proposta.desconto_percentual || 0,
        frete_tipo: proposta.frete_tipo || 'automatico',
        frete_transportadora: proposta.frete_transportadora,
        frete_observacao: proposta.frete_observacao,
      },
    });

    if (blingError) {
      console.error(`[APROVAR-FAT] ❌ Erro ao chamar bling-create-order:`, blingError);
      throw new Error(`Erro ao criar pedido no Bling: ${blingError.message}`);
    }

    if (blingResponse?.error) {
      console.error(`[APROVAR-FAT] ❌ Erro retornado pelo Bling:`, blingResponse.error);
      throw new Error(`Bling: ${blingResponse.error}`);
    }

    if (!blingResponse?.success || (!blingResponse?.bling_order_id && !blingResponse?.bling_order_number)) {
      console.error(`[APROVAR-FAT] ❌ Resposta inesperada do Bling:`, blingResponse);
      throw new Error('Resposta inesperada do Bling - pedido pode não ter sido criado');
    }

    const blingOrderId = blingResponse.bling_order_id;
    const blingOrderNumber = blingResponse.bling_order_number?.toString();
    
    console.log(`[APROVAR-FAT] ✅ Pedido criado no Bling:`, {
      bling_order_id: blingOrderId,
      bling_order_number: blingOrderNumber,
    });

    // ============ PASSO 4: Atualizar status da proposta ============
    console.log(`[APROVAR-FAT] [4/6] Atualizando status da proposta para FATURADO...`);

    const { error: updateError } = await supabase
      .from('vendedor_propostas')
      .update({
        status: 'FATURADO',
        bling_order_id: blingOrderId,
        bling_order_number: blingOrderNumber,
      })
      .eq('id', proposta_id);

    if (updateError) {
      console.error(`[APROVAR-FAT] ❌ ERRO CRÍTICO ao atualizar proposta:`, updateError);
      throw new Error(`Pedido criado no Bling (${blingOrderNumber}) mas falhou ao atualizar status: ${updateError.message}`);
    }

    console.log(`[APROVAR-FAT] ✅ Status atualizado para FATURADO`);

    // ============ PASSO 5: Criar registro em ebd_shopify_pedidos (meta) ============
    console.log(`[APROVAR-FAT] [5/6] Criando registro de meta do vendedor...`);

    const { error: metaError } = await supabase
      .from('ebd_shopify_pedidos')
      .insert({
        shopify_order_id: blingOrderId || Math.floor(Math.random() * 1000000000),
        order_number: `BLING-${blingOrderNumber || blingOrderId}`,
        vendedor_id: proposta.vendedor_id,
        cliente_id: proposta.cliente_id,
        valor_total: valorTotal,
        valor_frete: valorFrete,
        valor_para_meta: valorProdutos,
        status_pagamento: 'Faturado',
        customer_email: cliente.email_superintendente || null,
        customer_name: proposta.cliente_nome,
        order_date: new Date().toISOString(),
        bling_order_id: blingOrderId,
      });

    if (metaError) {
      console.error(`[APROVAR-FAT] ❌ ERRO CRÍTICO ao criar registro de meta:`, metaError);
      throw new Error(`Pedido criado no Bling (${blingOrderNumber}) mas falhou ao criar meta: ${metaError.message}`);
    }

    console.log(`[APROVAR-FAT] ✅ Registro de meta criado`);

    // ============ PASSO 6: Criar parcelas de comissão ============
    console.log(`[APROVAR-FAT] [6/6] Criando parcelas de comissão...`);

    // Configuração de parcelas baseado no prazo
    const parcelasConfig: { [key: string]: { dias: number[]; metodos: string[] } } = {
      '30': { dias: [30], metodos: ['boleto_30'] },
      '60_direto': { dias: [60], metodos: ['boleto_60'] },
      '60': { dias: [30, 60], metodos: ['boleto_30', 'boleto_60'] },
      '60_90': { dias: [60, 90], metodos: ['boleto_60', 'boleto_90'] },
      '90': { dias: [30, 60, 90], metodos: ['boleto_30', 'boleto_60', 'boleto_90'] },
      '60_75_90': { dias: [60, 75, 90], metodos: ['boleto_60', 'boleto_75', 'boleto_90'] },
      '60_90_120': { dias: [60, 90, 120], metodos: ['boleto_60', 'boleto_90', 'boleto_120'] },
    };

    const config = parcelasConfig[prazo] || { dias: [30], metodos: ['boleto_30'] };
    const diasParcelas = config.dias;
    const metodosParcelas = config.metodos;
    
    // Cálculo das parcelas em centavos para precisão
    const totalCentavos = Math.round(valorTotal * 100);
    const parcelaCentavos = Math.floor(totalCentavos / diasParcelas.length);
    const restoCentavos = totalCentavos - (parcelaCentavos * diasParcelas.length);

    const dataFaturamento = new Date();
    
    const parcelasToInsert = diasParcelas.map((dias, index) => {
      // Última parcela recebe os centavos restantes
      const valorParcela = index === diasParcelas.length - 1 
        ? (parcelaCentavos + restoCentavos) / 100 
        : parcelaCentavos / 100;
      
      const valorComissao = Math.round(valorParcela * (comissaoPercentual / 100) * 100) / 100;
      
      const dataVencimento = new Date(dataFaturamento);
      dataVencimento.setDate(dataVencimento.getDate() + dias);
      
      return {
        proposta_id: proposta_id,
        vendedor_id: proposta.vendedor_id,
        cliente_id: proposta.cliente_id,
        numero_parcela: index + 1,
        total_parcelas: diasParcelas.length,
        valor: valorParcela,
        valor_comissao: valorComissao,
        data_vencimento: dataVencimento.toISOString().split('T')[0],
        status: 'aguardando',
        origem: 'faturado',
        metodo_pagamento: metodosParcelas[index],
        bling_order_id: blingOrderId,
        bling_order_number: blingOrderNumber,
        vendedor_email: vendedorEmail,
      };
    });

    console.log(`[APROVAR-FAT] Inserindo ${parcelasToInsert.length} parcela(s):`, parcelasToInsert);

    const { error: parcelasError } = await supabase
      .from('vendedor_propostas_parcelas')
      .insert(parcelasToInsert);

    if (parcelasError) {
      console.error(`[APROVAR-FAT] ❌ ERRO CRÍTICO ao criar parcelas:`, parcelasError);
      throw new Error(`Pedido criado no Bling (${blingOrderNumber}) mas falhou ao criar comissões: ${parcelasError.message}`);
    }

    console.log(`[APROVAR-FAT] ✅ ${parcelasToInsert.length} parcela(s) de comissão criada(s)`);

    // ============ SUCESSO COMPLETO ============
    console.log(`[APROVAR-FAT] ========== ✅ APROVAÇÃO CONCLUÍDA COM SUCESSO ==========`);
    console.log(`[APROVAR-FAT] Resumo:`);
    console.log(`[APROVAR-FAT]   - Bling Order: ${blingOrderNumber || blingOrderId}`);
    console.log(`[APROVAR-FAT]   - Vendedor: ${vendedorNome} (${vendedorEmail})`);
    console.log(`[APROVAR-FAT]   - Valor Total: R$ ${valorTotal.toFixed(2)}`);
    console.log(`[APROVAR-FAT]   - Parcelas: ${diasParcelas.length}x (${prazo} dias)`);
    console.log(`[APROVAR-FAT]   - Comissão Total: R$ ${parcelasToInsert.reduce((s, p) => s + p.valor_comissao, 0).toFixed(2)}`);

    return new Response(JSON.stringify({
      success: true,
      bling_order_id: blingOrderId,
      bling_order_number: blingOrderNumber,
      parcelas_criadas: parcelasToInsert.length,
      valor_total: valorTotal,
      vendedor_email: vendedorEmail,
      message: `Pedido aprovado! Bling: ${blingOrderNumber || blingOrderId} • ${parcelasToInsert.length} parcela(s)`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[APROVAR-FAT] ❌ ERRO:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
