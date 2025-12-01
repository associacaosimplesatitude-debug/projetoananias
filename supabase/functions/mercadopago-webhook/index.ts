import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const mercadoPagoToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Mercado Pago envia notificações de diferentes tipos
    if (body.type === 'payment') {
      const paymentId = body.data?.id;
      
      if (!paymentId) {
        console.error('Payment ID not found in webhook');
        return new Response(JSON.stringify({ error: 'Payment ID not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Processing payment:', paymentId);

      // Buscar informações do pagamento no Mercado Pago
      const paymentResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            'Authorization': `Bearer ${mercadoPagoToken}`,
          },
        }
      );

      if (!paymentResponse.ok) {
        console.error('Failed to fetch payment from Mercado Pago');
        return new Response(JSON.stringify({ error: 'Failed to fetch payment' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const payment = await paymentResponse.json();
      console.log('Payment details:', JSON.stringify(payment, null, 2));

      // Atualizar o pedido no banco de dados
      let pedidoAtual = null;
      
      const { data: pedido, error: findError } = await supabase
        .from('ebd_pedidos')
        .select('*')
        .eq('mercadopago_payment_id', paymentId.toString())
        .single();

      if (findError || !pedido) {
        console.log('Pedido not found for payment_id:', paymentId);
        // Tenta buscar por preference_id caso payment_id ainda não esteja salvo
        const preferenceId = payment.preference_id || payment.external_reference;
        
        if (preferenceId) {
          const { data: pedidoByPref, error: prefError } = await supabase
            .from('ebd_pedidos')
            .select('*')
            .eq('mercadopago_preference_id', preferenceId)
            .single();

          if (prefError || !pedidoByPref) {
            console.error('Pedido not found by preference_id either');
            return new Response(JSON.stringify({ message: 'Pedido not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }

          pedidoAtual = pedidoByPref;

          // Atualizar com payment_id
          await supabase
            .from('ebd_pedidos')
            .update({ 
              mercadopago_payment_id: paymentId.toString(),
            })
            .eq('id', pedidoByPref.id);
        } else {
          console.error('No preference_id found');
          return new Response(JSON.stringify({ message: 'Pedido not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        pedidoAtual = pedido;
      }

      // Mapear status do Mercado Pago para nosso sistema
      let newStatus = 'pending';
      let approvedAt = null;

      if (payment.status === 'approved') {
        newStatus = 'approved';
        approvedAt = new Date().toISOString();
        console.log('Payment approved! Activating magazines...');

        // Buscar itens do pedido para ativar as revistas
        const { data: itens, error: itensError } = await supabase
          .from('ebd_pedidos_itens')
          .select('revista_id, quantidade')
          .eq('pedido_id', pedidoAtual.id);

        if (!itensError && itens) {
          // Ativar revistas comprando-as para a igreja
          const church_id = pedidoAtual.church_id;
          const purchases = itens.map(item => ({
            church_id,
            revista_id: item.revista_id,
            preco_pago: payment.transaction_amount / itens.length, // Dividir proporcional
          }));

          const { error: purchaseError } = await supabase
            .from('ebd_revistas_compradas')
            .insert(purchases);

          if (purchaseError) {
            console.error('Error activating magazines:', purchaseError);
          } else {
            console.log('Magazines activated successfully!');
          }
        }
      } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
        newStatus = payment.status;
      } else if (payment.status === 'in_process' || payment.status === 'pending') {
        newStatus = 'processing';
      }

      // Atualizar status do pedido
      const { error: updateError } = await supabase
        .from('ebd_pedidos')
        .update({
          status: newStatus,
          approved_at: approvedAt,
          mercadopago_payment_id: paymentId.toString(),
        })
        .eq('id', pedidoAtual.id);

      if (updateError) {
        console.error('Error updating order:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update order' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Order updated successfully');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Para outros tipos de notificação
    return new Response(JSON.stringify({ message: 'Notification received' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});