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
  console.log(`[${requestId}] mp-sync-payment-status iniciado`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { pedido_id, payment_id } = body;

    console.log(`[${requestId}] Request:`, { pedido_id, payment_id });

    if (!pedido_id && !payment_id) {
      throw new Error('pedido_id ou payment_id é obrigatório');
    }

    // 1. Buscar pedido
    let query = supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .select('*');

    if (pedido_id) {
      query = query.eq('id', pedido_id);
    } else {
      query = query.eq('mercadopago_payment_id', payment_id.toString());
    }

    const { data: pedido, error: pedidoError } = await query.single();

    if (pedidoError || !pedido) {
      console.error(`[${requestId}] Pedido não encontrado:`, pedidoError);
      throw new Error('Pedido não encontrado');
    }

    console.log(`[${requestId}] Pedido encontrado:`, pedido.id, 'Status atual:', pedido.status, 'Bling ID:', pedido.bling_order_id);

    // Se já tem Bling ID e status é PAGO, não precisa fazer nada
    if (pedido.bling_order_id && pedido.status === 'PAGO') {
      console.log(`[${requestId}] Pedido já sincronizado com Bling: ${pedido.bling_order_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Pedido já sincronizado',
          pedido_id: pedido.id,
          bling_order_id: pedido.bling_order_id,
          status: pedido.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 2. Consultar status no Mercado Pago
    const mpPaymentId = pedido.mercadopago_payment_id;
    if (!mpPaymentId) {
      throw new Error('Pedido não tem mercadopago_payment_id');
    }

    console.log(`[${requestId}] Consultando Mercado Pago payment:`, mpPaymentId);

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error(`[${requestId}] Erro ao consultar Mercado Pago:`, errorText);
      throw new Error('Erro ao consultar pagamento no Mercado Pago');
    }

    const payment = await mpResponse.json();
    console.log(`[${requestId}] Status Mercado Pago:`, payment.status, 'Status Detail:', payment.status_detail);

    // 3. Processar apenas se aprovado
    if (payment.status !== 'approved') {
      console.log(`[${requestId}] Pagamento não aprovado:`, payment.status);
      
      // Atualizar status no banco
      await supabase
        .from('ebd_shopify_pedidos_mercadopago')
        .update({
          payment_status: payment.status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Pagamento com status: ${payment.status}`,
          pedido_id: pedido.id,
          payment_status: payment.status,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 4. Pagamento aprovado - Atualizar status
    console.log(`[${requestId}] Pagamento APROVADO! Atualizando pedido e criando no Bling...`);

    // Normalizar metodo_frete: 'manual' → 'retirada' (Matriz RJ)
    let metodoFreteNormalizado = pedido.metodo_frete || 'pac';
    if (metodoFreteNormalizado === 'manual') {
      // Verificar se valor_frete é 0 (indica retirada)
      if (pedido.valor_frete === 0 || pedido.valor_frete === null) {
        metodoFreteNormalizado = 'retirada'; // Matriz RJ por padrão
      }
    }
    console.log(`[${requestId}] metodo_frete: ${pedido.metodo_frete} → normalizado: ${metodoFreteNormalizado}`);

    // 5. Criar pedido no Bling
    let blingOrderId = null;

    if (!pedido.bling_order_id) {
      try {
        const cliente = {
          id: pedido.cliente_id || null, // IMPORTANTE: ID do cliente no sistema para buscar CPF/CNPJ do banco
          nome: pedido.cliente_nome?.split(' ')[0] || 'Cliente',
          sobrenome: pedido.cliente_nome?.split(' ').slice(1).join(' ') || '',
          cpf_cnpj: pedido.cliente_cpf_cnpj || '',
          email: pedido.cliente_email || '',
          telefone: pedido.cliente_telefone || '',
        };

        const endereco_entrega = {
          rua: pedido.endereco_rua,
          numero: pedido.endereco_numero,
          complemento: pedido.endereco_complemento,
          bairro: pedido.endereco_bairro,
          cep: pedido.endereco_cep,
          cidade: pedido.endereco_cidade,
          estado: pedido.endereco_estado,
        };

        // Converter itens do JSON para formato Bling COM DESCONTO
        const items = pedido.items || [];
        const itensBling = items.map((item: any) => {
          const precoOriginal = Number(parseFloat(item.price || '0').toFixed(2));
          const descontoPercentual = item.descontoItem ?? 0;
          const precoComDesconto = Number((precoOriginal * (1 - descontoPercentual / 100)).toFixed(2));
          
          return {
            codigo: item.sku || item.variantId || '0',
            descricao: item.title || 'Produto Shopify',
            unidade: 'UN',
            quantidade: item.quantity || 1,
            preco_cheio: precoOriginal,           // Preço original (lista)
            valor: precoComDesconto,               // Preço com desconto aplicado
            desconto_percentual: descontoPercentual, // Percentual de desconto
          };
        });

        const paymentTypeMap: { [key: string]: string } = {
          'pix': 'pix',
          'card': 'card',
          'boleto': 'boleto',
          'credit_card': 'card',
          'debit_card': 'card',
          'account_money': 'pix',
          'bank_transfer': 'pix',
          'ticket': 'boleto',
        };
        const formaPagamento = paymentTypeMap[payment.payment_type_id] || paymentTypeMap[pedido.payment_method] || 'pix';

        console.log(`[${requestId}] Enviando para Bling:`, {
          cliente_id: pedido.cliente_id,
          cliente_nome: cliente.nome,
          cliente_cpf_cnpj: cliente.cpf_cnpj,
          metodo_frete: metodoFreteNormalizado,
          forma_pagamento: formaPagamento,
          itens_count: itensBling.length,
        });

        const blingResponse = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            cliente,
            cliente_id: pedido.cliente_id, // Passar cliente_id também no root para garantir
            endereco_entrega,
            itens: itensBling,
            pedido_id: pedido.id.slice(0, 8).toUpperCase(),
            valor_frete: pedido.valor_frete || 0,
            metodo_frete: metodoFreteNormalizado, // Normalizado!
            forma_pagamento: formaPagamento,
            valor_produtos: pedido.valor_produtos || 0,
            valor_total: pedido.valor_total || 0,
            // Dados do vendedor
            vendedor_email: pedido.vendedor_email,
            vendedor_nome: pedido.vendedor_nome,
            vendedor_id: pedido.vendedor_id,
            // Identificador de origem
            origem: 'shopify_mercadopago',
          }),
        });

        if (blingResponse.ok) {
          const blingData = await blingResponse.json();
          console.log(`[${requestId}] Resposta do Bling:`, blingData);
          
          if (blingData.bling_order_id) {
            blingOrderId = blingData.bling_order_id;
            console.log(`[${requestId}] ✅ Pedido criado no Bling: ${blingOrderId}`);
          }
        } else {
          const errorText = await blingResponse.text();
          console.error(`[${requestId}] Erro ao criar pedido no Bling:`, errorText);
        }
      } catch (blingError) {
        console.error(`[${requestId}] Erro ao chamar bling-create-order:`, blingError);
      }
    }

    // 6. Atualizar pedido no banco
    const { error: updateError } = await supabase
      .from('ebd_shopify_pedidos_mercadopago')
      .update({
        status: 'PAGO',
        payment_status: 'approved',
        bling_order_id: blingOrderId || pedido.bling_order_id,
        bling_created_at: blingOrderId ? new Date().toISOString() : pedido.bling_created_at,
        metodo_frete: metodoFreteNormalizado, // Salvar o valor normalizado
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id);

    if (updateError) {
      console.error(`[${requestId}] Erro ao atualizar pedido:`, updateError);
    }

    // 7. Criar parcela paga para comissão do vendedor (Mercado Pago = pagamento à vista)
    if (pedido.vendedor_id) {
      try {
        // Buscar comissão do vendedor
        const { data: vendedorData } = await supabase
          .from('vendedores')
          .select('comissao_percentual')
          .eq('id', pedido.vendedor_id)
          .single();

        const comissaoPercentual = vendedorData?.comissao_percentual || 1.5;
        const valorTotal = pedido.valor_total || 0;
        const valorComissao = Math.round((valorTotal * (comissaoPercentual / 100)) * 100) / 100;
        const hoje = new Date().toISOString().split('T')[0];

        const { error: parcelaError } = await supabase
          .from('vendedor_propostas_parcelas')
          .insert({
            proposta_id: null,  // Não tem proposta associada
            vendedor_id: pedido.vendedor_id,
            cliente_id: pedido.cliente_id,
            numero_parcela: 1,
            total_parcelas: 1,
            valor: valorTotal,
            valor_comissao: valorComissao,
            data_vencimento: hoje,
            data_pagamento: hoje,  // Já pago!
            status: 'paga',
            origem: 'mercadopago',
            comissao_status: 'liberada',  // ✅ Comissão já liberada para pagamento
            data_liberacao: hoje,          // ✅ Data da liberação
            metodo_pagamento: pedido.payment_method === 'pix' ? 'pix' : 
                             pedido.payment_method === 'credit_card' ? 'cartao' : 
                             pedido.payment_method === 'debit_card' ? 'cartao_debito' : 'pix',
          });

        if (parcelaError) {
          console.error(`[${requestId}] Erro ao criar parcela:`, parcelaError);
        } else {
          console.log(`[${requestId}] ✅ Parcela paga criada para vendedor ${pedido.vendedor_id} - Comissão: R$ ${valorComissao}`);
        }
      } catch (parcelaErr) {
        console.error(`[${requestId}] Erro ao gerar parcela:`, parcelaErr);
      }
    }

    console.log(`[${requestId}] ✅ Sincronização concluída!`, {
      pedido_id: pedido.id,
      status: 'PAGO',
      bling_order_id: blingOrderId || pedido.bling_order_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Pedido sincronizado com sucesso',
        pedido_id: pedido.id,
        bling_order_id: blingOrderId || pedido.bling_order_id,
        status: 'PAGO',
        metodo_frete_normalizado: metodoFreteNormalizado,
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
