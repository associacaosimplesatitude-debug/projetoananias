import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    console.log('Webhook recebido:', body);

    const { type, data } = body;

    if (type === 'payment') {
      const paymentId = data.id;

      // Buscar detalhes do pagamento na API do Mercado Pago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!paymentResponse.ok) {
        throw new Error('Erro ao buscar pagamento no Mercado Pago');
      }

      const payment = await paymentResponse.json();
      console.log('Pagamento:', payment.id, 'Status:', payment.status, 'Método:', payment.payment_type_id);

      // PRIMEIRO: Tentar buscar na nova tabela ebd_shopify_pedidos_mercadopago
      const { data: shopifyMPPedido, error: shopifyMPError } = await supabase
        .from('ebd_shopify_pedidos_mercadopago')
        .select('*')
        .eq('mercadopago_payment_id', paymentId.toString())
        .maybeSingle();

      if (shopifyMPPedido) {
        console.log('Pedido encontrado na tabela ebd_shopify_pedidos_mercadopago:', shopifyMPPedido.id);
        await processShopifyMPPedido(supabase, supabaseUrl, supabaseKey, shopifyMPPedido, payment);
        
        return new Response(
          JSON.stringify({ success: true, source: 'shopify_mp' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // SEGUNDO: Tentar tabela original ebd_pedidos
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .select(`
          *,
          ebd_pedidos_itens(
            quantidade,
            preco_unitario,
            revista:ebd_revistas(titulo, bling_produto_id)
          ),
          church:churches(church_name, pastor_email, pastor_whatsapp, cnpj)
        `)
        .eq('mercadopago_payment_id', paymentId)
        .single();

      if (pedidoError || !pedido) {
        console.log('Pedido não encontrado para payment_id:', paymentId);
        return new Response(
          JSON.stringify({ message: 'Pedido não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      let newStatus = pedido.status;
      let paymentStatus = payment.status;
      let emailType = '';
      let blingOrderId = pedido.bling_order_id;

      if (payment.status === 'approved') {
        newStatus = 'PAGO';
        emailType = 'payment_approved';
        
        // Ativar revistas compradas
        const { data: itens } = await supabase
          .from('ebd_pedidos_itens')
          .select('revista_id, quantidade, preco_unitario')
          .eq('pedido_id', pedido.id);

        if (itens && itens.length > 0) {
          for (const item of itens) {
            await supabase.from('ebd_revistas_compradas').insert({
              church_id: pedido.church_id,
              revista_id: item.revista_id,
              preco_pago: item.preco_unitario,
              data_compra: new Date().toISOString(),
            });
          }
        }

        // CRIAR PEDIDO NO BLING se ainda não foi criado
        if (!pedido.bling_order_id) {
          try {
            console.log('Criando pedido no Bling para pedido:', pedido.id);
            
            const cliente = {
              nome: pedido.nome_cliente || pedido.email_cliente?.split('@')[0] || 'Cliente',
              sobrenome: pedido.sobrenome_cliente || '',
              cpf_cnpj: pedido.cpf_cnpj_cliente || pedido.church?.cnpj || '',
              email: pedido.email_cliente || '',
              telefone: pedido.telefone_cliente || pedido.church?.pastor_whatsapp || '',
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

            const itensBling = pedido.ebd_pedidos_itens?.map((item: any) => ({
              codigo: item.revista?.bling_produto_id?.toString() || '0',
              descricao: item.revista?.titulo || 'Revista EBD',
              unidade: 'UN',
              quantidade: item.quantidade,
              valor: Number(item.preco_unitario.toFixed(2)),
            })) || [];

            const paymentTypeMap: { [key: string]: string } = {
              'credit_card': 'card',
              'debit_card': 'card',
              'account_money': 'pix',
              'bank_transfer': 'pix',
              'ticket': 'boleto',
            };
            const formaPagamento = paymentTypeMap[payment.payment_type_id] || 'pix';

            const blingResponse = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                cliente,
                endereco_entrega,
                itens: itensBling,
                pedido_id: pedido.id.slice(0, 8).toUpperCase(),
                valor_frete: pedido.valor_frete || 0,
                metodo_frete: pedido.metodo_frete || 'pac',
                forma_pagamento: formaPagamento,
                valor_produtos: pedido.valor_produtos || 0,
                valor_total: pedido.valor_total || 0,
              }),
            });

            if (blingResponse.ok) {
              const blingData = await blingResponse.json();
              console.log('Resposta do Bling:', blingData);
              
              if (blingData.bling_order_id) {
                blingOrderId = blingData.bling_order_id;
                console.log('Pedido criado no Bling com ID:', blingOrderId);
              }
            } else {
              const errorText = await blingResponse.text();
              console.error('Erro ao criar pedido no Bling:', errorText);
            }
          } catch (blingError) {
            console.error('Erro ao chamar bling-create-order:', blingError);
          }
        }
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        newStatus = 'CANCELADO';
        emailType = 'payment_rejected';
      } else if (payment.status === 'pending' || payment.status === 'in_process') {
        emailType = 'payment_pending';
      }

      // Atualizar pedido incluindo bling_order_id
      await supabase
        .from('ebd_pedidos')
        .update({
          status: newStatus,
          payment_status: paymentStatus,
          approved_at: payment.status === 'approved' ? new Date().toISOString() : null,
          bling_order_id: blingOrderId,
        })
        .eq('id', pedido.id);

      console.log('Pedido atualizado:', pedido.id, 'Novo status:', newStatus, 'Bling ID:', blingOrderId);

      // Enviar email de notificação
      if (emailType) {
        try {
          console.log('Enviando email:', emailType, 'para pedido:', pedido.id);
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-order-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              orderId: pedido.id,
              emailType: emailType,
            }),
          });

          if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            console.error('Erro ao enviar email:', errorText);
          } else {
            console.log('Email enviado com sucesso');
          }
        } catch (emailError) {
          console.error('Erro ao chamar função de email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro no webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// Função para processar pedidos da tabela ebd_shopify_pedidos_mercadopago
async function processShopifyMPPedido(
  supabase: any, 
  supabaseUrl: string, 
  supabaseKey: string,
  pedido: any, 
  payment: any
) {
  console.log('Processando pedido Shopify MP:', pedido.id);
  
  let newStatus = pedido.status;
  let paymentStatus = payment.status;
  let blingOrderId = pedido.bling_order_id;

  if (payment.status === 'approved') {
    newStatus = 'PAGO';

    // CRIAR PEDIDO NO BLING COM EMAIL DO VENDEDOR!
    if (!pedido.bling_order_id) {
      try {
        console.log('Criando pedido no Bling para pedido Shopify MP:', pedido.id);
        console.log('VENDEDOR EMAIL:', pedido.vendedor_email); // IMPORTANTE: Email do vendedor!
        
        const cliente = {
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

        // Converter itens do JSON para formato Bling
        const items = pedido.items || [];
        const itensBling = items.map((item: any) => ({
          codigo: item.sku || item.variantId || '0',
          descricao: item.title || 'Produto Shopify',
          unidade: 'UN',
          quantidade: item.quantity || 1,
          valor: Number(parseFloat(item.price || '0').toFixed(2)),
        }));

        const paymentTypeMap: { [key: string]: string } = {
          'credit_card': 'card',
          'debit_card': 'card',
          'account_money': 'pix',
          'bank_transfer': 'pix',
          'ticket': 'boleto',
        };
        const formaPagamento = paymentTypeMap[payment.payment_type_id] || pedido.payment_method || 'pix';

        const blingResponse = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            cliente,
            endereco_entrega,
            itens: itensBling,
            pedido_id: pedido.id.slice(0, 8).toUpperCase(),
            valor_frete: pedido.valor_frete || 0,
            metodo_frete: pedido.metodo_frete || 'pac',
            forma_pagamento: formaPagamento,
            valor_produtos: pedido.valor_produtos || 0,
            valor_total: pedido.valor_total || 0,
            // IMPORTANTE: Passando o email do vendedor!
            vendedor_email: pedido.vendedor_email,
            vendedor_nome: pedido.vendedor_nome,
            vendedor_id: pedido.vendedor_id,
            // Identificador de origem
            origem: 'shopify_mercadopago',
          }),
        });

        if (blingResponse.ok) {
          const blingData = await blingResponse.json();
          console.log('Resposta do Bling (Shopify MP):', blingData);
          
          if (blingData.bling_order_id) {
            blingOrderId = blingData.bling_order_id;
            console.log('Pedido criado no Bling com ID:', blingOrderId, 'Vendedor:', pedido.vendedor_email);
          }
        } else {
          const errorText = await blingResponse.text();
          console.error('Erro ao criar pedido no Bling (Shopify MP):', errorText);
        }
      } catch (blingError) {
        console.error('Erro ao chamar bling-create-order (Shopify MP):', blingError);
      }
    }
  } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
    newStatus = 'CANCELADO';
  }

  // Atualizar pedido
  await supabase
    .from('ebd_shopify_pedidos_mercadopago')
    .update({
      status: newStatus,
      payment_status: paymentStatus,
      bling_order_id: blingOrderId,
      bling_created_at: blingOrderId ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedido.id);

  console.log('Pedido Shopify MP atualizado:', pedido.id, 'Status:', newStatus, 'Bling ID:', blingOrderId);
}
