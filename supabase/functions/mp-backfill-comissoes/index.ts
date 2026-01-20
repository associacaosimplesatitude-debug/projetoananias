import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * mp-backfill-comissoes
 * 
 * Função de backfill para criar comissões retroativas para pedidos Mercado Pago
 * que já foram pagos mas não tiveram suas comissões criadas.
 * 
 * Condições para criar comissão:
 * - status = 'PAGO'
 * - vendedor_id não nulo
 * - Não existe parcela com mp_pedido_id igual ao pedido.id
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] 🔄 Iniciando backfill de comissões MP...`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar pedidos PAGO com vendedor
    const { data: pedidosPagos, error: queryError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .select(`
        id, proposta_id, vendedor_id, vendedor_email, cliente_id,
        valor_total, payment_method, bling_order_id, created_at
      `)
      .eq('status', 'PAGO')
      .not('vendedor_id', 'is', null)
      .order('created_at', { ascending: false });

    if (queryError) {
      console.error(`[${requestId}] Erro ao buscar pedidos:`, queryError);
      return new Response(JSON.stringify({ error: queryError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log(`[${requestId}] Encontrados ${pedidosPagos?.length || 0} pedidos PAGO com vendedor`);

    let criadas = 0;
    let jaExistentes = 0;
    let erros = 0;
    const detalhes: any[] = [];

    for (const pedido of pedidosPagos || []) {
      // Verificar se já tem comissão para este pedido MP
      const { data: existingParcela } = await supabase
        .from('vendedor_propostas_parcelas')
        .select('id')
        .eq('mp_pedido_id', pedido.id)
        .maybeSingle();

      if (existingParcela) {
        jaExistentes++;
        continue;
      }

      // Buscar percentual e email do vendedor
      const { data: vendedorData } = await supabase
        .from('vendedores')
        .select('comissao_percentual, email, nome')
        .eq('id', pedido.vendedor_id)
        .single();

      const comissaoPercentual = vendedorData?.comissao_percentual || 1.5;
      const valorTotal = pedido.valor_total || 0;
      const valorComissao = Math.round((valorTotal * (comissaoPercentual / 100)) * 100) / 100;
      
      // Usar data do pedido para manter consistência histórica
      const dataPagamento = pedido.created_at?.split('T')[0] || new Date().toISOString().split('T')[0];

      // Usar email do pedido ou do vendedor como fallback
      const vendedorEmail = pedido.vendedor_email || vendedorData?.email || null;

      // Verificar se proposta_id existe antes de usar (evitar FK constraint)
      let propostaIdValida = null;
      if (pedido.proposta_id) {
        const { data: proposta } = await supabase
          .from('vendedor_propostas')
          .select('id')
          .eq('id', pedido.proposta_id)
          .maybeSingle();
        propostaIdValida = proposta?.id || null;
      }

      const { error: insertError } = await supabase
        .from('vendedor_propostas_parcelas')
        .insert({
          proposta_id: propostaIdValida,  // ✅ Só usa se existir
          vendedor_id: pedido.vendedor_id,
          vendedor_email: vendedorEmail, // ✅ Garantindo email do vendedor
          cliente_id: pedido.cliente_id,
          numero_parcela: 1,
          total_parcelas: 1,
          valor: valorTotal,
          valor_comissao: valorComissao,
          data_vencimento: dataPagamento,
          data_pagamento: dataPagamento,
          status: 'paga',
          origem: 'mercadopago',
          comissao_status: 'liberada', // ✅ Direto para "A Pagar"
          data_liberacao: dataPagamento,
          bling_order_id: pedido.bling_order_id,
          mp_pedido_id: pedido.id, // ✅ Chave única para deduplicação
          metodo_pagamento: pedido.payment_method === 'pix' ? 'pix' : 
                           pedido.payment_method === 'credit_card' ? 'cartao' : 
                           pedido.payment_method === 'debit_card' ? 'cartao_debito' : 'pix',
        });

      if (insertError) {
        console.error(`[${requestId}] ❌ Erro pedido ${pedido.id}:`, insertError);
        erros++;
        detalhes.push({
          pedido_id: pedido.id,
          status: 'erro',
          error: insertError.message,
        });
      } else {
        console.log(`[${requestId}] ✅ Comissão criada: ${pedido.id} → ${vendedorEmail} R$${valorComissao}`);
        criadas++;
        detalhes.push({
          pedido_id: pedido.id,
          status: 'criada',
          vendedor_email: vendedorEmail,
          valor_comissao: valorComissao,
          bling_order_id: pedido.bling_order_id,
        });
      }
    }

    const resultado = {
      success: true,
      request_id: requestId,
      total_analisados: pedidosPagos?.length || 0,
      comissoes_criadas: criadas,
      ja_existentes: jaExistentes,
      erros: erros,
      detalhes: detalhes,
    };

    console.log(`[${requestId}] 🏁 Backfill concluído:`, {
      total: resultado.total_analisados,
      criadas: resultado.comissoes_criadas,
      existentes: resultado.ja_existentes,
      erros: resultado.erros,
    });

    return new Response(JSON.stringify(resultado), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error(`[${requestId}] Erro fatal:`, error);
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
