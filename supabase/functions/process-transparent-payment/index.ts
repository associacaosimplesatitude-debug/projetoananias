import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentData {
  token: string;
  payment_method_id: string;
  order_id: string;
  installments: number;
  payer: {
    email: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}

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

    const paymentData: PaymentData = await req.json();
    
    console.log('Processando pagamento transparente:', {
      order_id: paymentData.order_id,
      payment_method: paymentData.payment_method_id,
      installments: paymentData.installments,
    });

    // Buscar pedido no banco
    const { data: pedido, error: pedidoError } = await supabase
      .from('ebd_pedidos')
      .select('*, ebd_pedidos_itens(quantidade, preco_unitario, ebd_revistas(titulo))')
      .eq('id', paymentData.order_id)
      .single();

    if (pedidoError || !pedido) {
      throw new Error('Pedido não encontrado');
    }

    // Preparar dados do pagamento para o Mercado Pago
    const paymentPayload = {
      token: paymentData.token,
      payment_method_id: paymentData.payment_method_id,
      installments: paymentData.installments,
      transaction_amount: pedido.valor_total,
      description: `Pedido EBD - ${pedido.id.slice(0, 8)}`,
      external_reference: pedido.id,
      payer: {
        email: paymentData.payer.email,
        ...(paymentData.payer.identification && {
          identification: paymentData.payer.identification,
        }),
      },
      notification_url: `${supabaseUrl}/functions/v1/mercadopago-webhook`,
      metadata: {
        order_id: pedido.id,
      },
    };

    console.log('Enviando pagamento para Mercado Pago...');

    // Criar pagamento no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text();
      console.error('Erro Mercado Pago:', errorData);
      throw new Error(`Erro ao processar pagamento: ${mpResponse.statusText}`);
    }

    const mpData = await mpResponse.json();
    console.log('Pagamento criado:', {
      id: mpData.id,
      status: mpData.status,
      status_detail: mpData.status_detail,
    });

    // Atualizar pedido com ID do pagamento
    const { error: updateError } = await supabase
      .from('ebd_pedidos')
      .update({
        mercadopago_payment_id: mpData.id.toString(),
        status: mpData.status,
      })
      .eq('id', pedido.id);

    if (updateError) {
      console.error('Erro ao atualizar pedido:', updateError);
    }

    // Se aprovado, ativar revistas
    if (mpData.status === 'approved') {
      console.log('Pagamento aprovado! Ativando revistas...');
      
      const { error: updatePedidoError } = await supabase
        .from('ebd_pedidos')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', pedido.id);

      if (updatePedidoError) {
        console.error('Erro ao atualizar status do pedido:', updatePedidoError);
      }

      // Ativar revistas compradas
      const revistasCompradas = pedido.ebd_pedidos_itens.map((item: any) => ({
        church_id: pedido.church_id,
        revista_id: item.revista_id,
        preco_pago: item.preco_total,
      }));

      const { error: revistaError } = await supabase
        .from('ebd_revistas_compradas')
        .insert(revistasCompradas);

      if (revistaError) {
        console.error('Erro ao ativar revistas:', revistaError);
      } else {
        console.log(`${revistasCompradas.length} revistas ativadas com sucesso!`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: mpData.id,
        status: mpData.status,
        status_detail: mpData.status_detail,
        order_id: pedido.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro ao processar pagamento:', error);
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
