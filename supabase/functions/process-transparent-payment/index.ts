// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { 
      payment_method, 
      transaction_amount, 
      description, 
      payer, 
      card,
      installments = 1,
      items,
      shipping_cost = 0
    } = await req.json();

    // Arredondar para 2 casas decimais (Mercado Pago exige exatamente 2 casas)
    const roundedAmount = Math.round(transaction_amount * 100) / 100;

    console.log('Processando pagamento transparente:', {
      payment_method,
      transaction_amount: roundedAmount,
      payer_email: payer.email,
    });

    let paymentData: any = {
      transaction_amount: roundedAmount,
      description,
      payer: {
        email: payer.email,
        first_name: payer.first_name,
        last_name: payer.last_name,
        identification: payer.identification,
      },
    };

    // Processar de acordo com o método de pagamento
    if (payment_method === 'pix') {
      paymentData.payment_method_id = 'pix';
      
      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro Mercado Pago PIX:', errorData);
        throw new Error(`Erro ao criar pagamento PIX: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Pagamento PIX criado:', data.id);

      return new Response(
        JSON.stringify({
          id: data.id,
          status: data.status,
          qr_code: data.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
          ticket_url: data.point_of_interaction?.transaction_data?.ticket_url,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payment_method === 'card') {
      if (!card) {
        throw new Error('Dados do cartão não fornecidos');
      }

      // Obter o payment_method_id do cartão
      const binResponse = await fetch(`https://api.mercadopago.com/v1/payment_methods/search?bin=${card.card_number.substring(0, 6)}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const binData = await binResponse.json();
      const paymentMethodId = binData.results?.[0]?.id || 'visa';

      // Criar token do cartão
      const cardTokenResponse = await fetch('https://api.mercadopago.com/v1/card_tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          card_number: card.card_number,
          cardholder: {
            name: card.cardholder_name,
            identification: payer.identification,
          },
          security_code: card.security_code,
          expiration_month: card.expiration_month,
          expiration_year: card.expiration_year,
        }),
      });

      if (!cardTokenResponse.ok) {
        const errorData = await cardTokenResponse.text();
        console.error('Erro ao criar token do cartão:', errorData);
        throw new Error('Erro ao processar dados do cartão');
      }

      const cardTokenData = await cardTokenResponse.json();

      paymentData.token = cardTokenData.id;
      paymentData.payment_method_id = paymentMethodId;
      paymentData.installments = installments;

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro Mercado Pago Cartão:', errorData);
        throw new Error(`Erro ao processar pagamento: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Pagamento com cartão processado:', data.id, 'status:', data.status);

      return new Response(
        JSON.stringify({
          id: data.id,
          status: data.status,
          status_detail: data.status_detail,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    } else if (payment_method === 'boleto') {
      paymentData.payment_method_id = 'bolbradesco';
      
      if (payer.address) {
        paymentData.payer.address = payer.address;
      }

      const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro Mercado Pago Boleto:', errorData);
        throw new Error(`Erro ao criar boleto: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Boleto criado:', data.id);

      return new Response(
        JSON.stringify({
          id: data.id,
          status: data.status,
          external_resource_url: data.transaction_details?.external_resource_url,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    throw new Error('Método de pagamento não suportado');
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
