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

    // Mercado Pago envia notificações em formato específico
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
      console.log('Pagamento:', payment.id, 'Status:', payment.status);

      // Buscar pedido pelo mercadopago_payment_id
      const { data: pedido, error: pedidoError } = await supabase
        .from('ebd_pedidos')
        .select('*')
        .eq('mercadopago_payment_id', paymentId)
        .single();

      if (pedidoError || !pedido) {
        console.log('Pedido não encontrado para payment_id:', paymentId);
        return new Response(
          JSON.stringify({ message: 'Pedido não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Atualizar status do pedido baseado no status do pagamento
      let newStatus = pedido.status;
      let paymentStatus = payment.status;
      let emailType = '';

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
        })
        .eq('id', pedido.id);

      console.log('Pedido atualizado:', pedido.id, 'Novo status:', newStatus);

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
