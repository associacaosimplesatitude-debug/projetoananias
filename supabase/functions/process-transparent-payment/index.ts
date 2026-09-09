// v2 - deploy fix 2026-02-05
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

    // ===== Recalcula o valor no servidor (nunca confiar no valor do cliente) =====
    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Itens do pedido são obrigatórios');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } },
    );

    const revistaIds = [...new Set(items.map((i: any) => i.id))];
    const { data: revistasDb, error: revistasError } = await supabase
      .from('ebd_revistas')
      .select('id, preco_cheio')
      .in('id', revistaIds);

    if (revistasError) throw revistasError;

    let subtotal = 0;
    for (const item of items) {
      const revista = revistasDb?.find((r: any) => r.id === item.id);
      if (!revista) {
        throw new Error('Item inválido no pedido');
      }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
        throw new Error('Quantidade inválida no pedido');
      }
      subtotal += Number(revista.preco_cheio || 0) * 0.7 * quantity;
    }

    const frete = Math.max(0, Number(shipping_cost) || 0);
    const serverAmount = Math.round((subtotal + frete) * 100) / 100;

    if (serverAmount <= 0) {
      throw new Error('Valor do pedido inválido');
    }

    const clientAmount = Math.round((Number(transaction_amount) || 0) * 100) / 100;
    if (Math.abs(clientAmount - serverAmount) > 0.01) {
      console.error('[PAGAMENTO] Divergência de valor', { clientAmount, serverAmount });
      return new Response(
        JSON.stringify({ error: 'Valor do pedido divergente. Atualize a página e tente novamente.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Cobra sempre o valor calculado no servidor
    const roundedAmount = serverAmount;

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
