import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
}

interface PaymentRequest {
  items: PaymentItem[];
  payment_method: 'pix' | 'card' | 'boleto';
  payer: {
    email: string;
    name: string;
  };
  address: {
    street_name: string;
    street_number: string;
    zip_code: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!accessToken) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado');
    }

    const { items, payment_method, payer, address }: PaymentRequest = await req.json();
    
    console.log('Criando preferência de pagamento Mercado Pago:', {
      items: items.length,
      payment_method,
      payer_email: payer.email,
    });

    // Criar preferência de pagamento no Mercado Pago
    const preferenceData = {
      items: items.map(item => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unit_price,
        currency_id: 'BRL',
      })),
      payer: {
        email: payer.email,
        name: payer.name,
        address: {
          street_name: address.street_name,
          street_number: address.street_number,
          zip_code: address.zip_code,
        },
      },
      payment_methods: {
        excluded_payment_types: [] as Array<{ id: string }>,
        installments: 12,
      },
      back_urls: {
        success: `${req.headers.get('origin')}/ebd/catalogo?status=success`,
        failure: `${req.headers.get('origin')}/ebd/checkout?status=failure`,
        pending: `${req.headers.get('origin')}/ebd/catalogo?status=pending`,
      },
      auto_return: 'approved',
      notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
    };

    // Se for PIX, configurar para gerar QR Code
    if (payment_method === 'pix') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
        { id: 'ticket' },
      ];
    } else if (payment_method === 'boleto') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'credit_card' },
        { id: 'debit_card' },
      ];
    } else if (payment_method === 'card') {
      preferenceData.payment_methods.excluded_payment_types = [
        { id: 'ticket' },
      ];
    }

    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(preferenceData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro Mercado Pago:', errorData);
      throw new Error(`Erro ao criar preferência: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Preferência criada com sucesso:', data.id);

    return new Response(
      JSON.stringify({
        id: data.id,
        init_point: data.init_point,
        sandbox_init_point: data.sandbox_init_point,
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