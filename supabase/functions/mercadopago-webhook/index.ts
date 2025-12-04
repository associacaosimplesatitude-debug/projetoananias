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

      // Buscar pedido com dados completos
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .select(`
          *,
          ebd_pedidos_itens(
            quantidade,
            preco_unitario,
            preco_total,
            revista:ebd_revistas(titulo, bling_produto_id, preco_cheio)
          )
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
            
            // =============================================
            // TODOS OS DADOS VÊM DO FORMULÁRIO DO PEDIDO
            // =============================================
            
            // Nome completo do cliente (do formulário)
            const nomeCompleto = pedido.sobrenome_cliente 
              ? `${pedido.nome_cliente} ${pedido.sobrenome_cliente}` 
              : pedido.nome_cliente || 'Cliente';
            
            // Dados do CONTATO (para NF) - DO FORMULÁRIO
            const contato = {
              nome: nomeCompleto,
              tipoPessoa: (pedido.cpf_cnpj_cliente || '').replace(/\D/g, '').length > 11 ? 'J' : 'F',
              cpf_cnpj: pedido.cpf_cnpj_cliente || '',
              email: pedido.email_cliente || '',
              telefone: pedido.telefone_cliente || '',
              // Endereço do CONTATO (mesmo do formulário)
              endereco: pedido.endereco_rua || '',
              numero: pedido.endereco_numero || 'S/N',
              complemento: pedido.endereco_complemento || '',
              bairro: pedido.endereco_bairro || '',
              cep: pedido.endereco_cep || '',
              cidade: pedido.endereco_cidade || '',
              uf: pedido.endereco_estado || '',
            };
            
            console.log('Contato (NF) - DO FORMULÁRIO:', JSON.stringify(contato, null, 2));

            // Endereço de ENTREGA - DO FORMULÁRIO
            const endereco_entrega = {
              nome: nomeCompleto,
              rua: pedido.endereco_rua || '',
              numero: pedido.endereco_numero || 'S/N',
              complemento: pedido.endereco_complemento || '',
              bairro: pedido.endereco_bairro || '',
              cep: pedido.endereco_cep || '',
              cidade: pedido.endereco_cidade || '',
              estado: pedido.endereco_estado || '',
            };
            
            console.log('Endereço Entrega - DO FORMULÁRIO:', JSON.stringify(endereco_entrega, null, 2));

            // ITENS com preço de lista e desconto
            const itensBling = pedido.ebd_pedidos_itens?.map((item: any) => {
              const codigoBling = item.revista?.bling_produto_id?.toString() || '0';
              const precoLista = Number(item.revista?.preco_cheio || item.preco_unitario);
              const precoComDesconto = Number(item.preco_unitario);
              
              console.log(`Item: ${item.revista?.titulo}`);
              console.log(`  - Código Bling: ${codigoBling}`);
              console.log(`  - Preço Lista: R$ ${precoLista.toFixed(2)}`);
              console.log(`  - Preço Desconto: R$ ${precoComDesconto.toFixed(2)}`);
              
              return {
                codigo: codigoBling,
                descricao: item.revista?.titulo || 'Revista EBD',
                unidade: 'UN',
                quantidade: item.quantidade,
                preco_cheio: precoLista,
                valor: precoComDesconto,
              };
            }) || [];

            // Forma de pagamento
            const paymentTypeMap: { [key: string]: string } = {
              'credit_card': 'card',
              'debit_card': 'card',
              'account_money': 'pix',
              'bank_transfer': 'pix',
              'ticket': 'boleto',
            };
            const formaPagamento = paymentTypeMap[payment.payment_type_id] || 'pix';

            // CHAMAR BLING-CREATE-ORDER
            console.log('Enviando para bling-create-order...');
            
            const blingResponse = await fetch(`${supabaseUrl}/functions/v1/bling-create-order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({
                // Dados do CONTATO para NF (do formulário)
                contato: contato,
                // Endereço de ENTREGA (do formulário)
                endereco_entrega: endereco_entrega,
                // Itens
                itens: itensBling,
                // Dados do pedido
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

      // Atualizar pedido
      await supabase
        .from('ebd_pedidos')
        .update({
          status: newStatus,
          payment_status: paymentStatus,
          approved_at: payment.status === 'approved' ? new Date().toISOString() : null,
          bling_order_id: blingOrderId,
        })
        .eq('id', pedido.id);

      console.log('Pedido atualizado:', pedido.id, 'Status:', newStatus, 'Bling ID:', blingOrderId);

      // Enviar email
      if (emailType) {
        try {
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
            console.error('Erro ao enviar email:', await emailResponse.text());
          }
        } catch (emailError) {
          console.error('Erro ao chamar função de email:', emailError);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
