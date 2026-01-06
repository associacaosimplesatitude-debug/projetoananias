import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain',
};

// Validar HMAC do webhook Shopify
function verifyShopifyWebhook(body: string, hmacHeader: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(body);
  const computedHmac = hmac.digest('base64');
  return computedHmac === hmacHeader;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';
    const topic = req.headers.get('x-shopify-topic') || '';
    const shopDomain = req.headers.get('x-shopify-shop-domain') || '';

    console.log('=== WEBHOOK RECEBIDO ===');
    console.log('Topic:', topic);
    console.log('Shop Domain:', shopDomain);
    console.log('HMAC Header presente:', !!hmacHeader);

    // Validar HMAC se configurado
    const webhookSecret = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
    if (webhookSecret && hmacHeader) {
      const isValid = verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret);
      console.log('HMAC válido:', isValid);
      if (!isValid) {
        console.warn('HMAC inválido - webhook rejeitado');
        return new Response(JSON.stringify({ error: 'Invalid HMAC' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401
        });
      }
    }

    // Parse do payload
    const order = JSON.parse(rawBody);

    // Logar o payload COMPLETO para descobrir onde está o CPF/CNPJ
    console.log('=== PAYLOAD COMPLETO DO WEBHOOK ===');
    console.log(JSON.stringify(order, null, 2));

    // Logar campos específicos que podem ter o CPF/CNPJ
    console.log('=== CAMPOS ESPECÍFICOS ===');
    console.log('order.id:', order.id);
    console.log('order.name:', order.name);
    console.log('order.note:', order.note);
    console.log('order.note_attributes:', JSON.stringify(order.note_attributes));
    console.log('order.tax_lines:', JSON.stringify(order.tax_lines));
    console.log('order.customer:', JSON.stringify(order.customer));
    console.log('order.billing_address:', JSON.stringify(order.billing_address));
    console.log('order.shipping_address:', JSON.stringify(order.shipping_address));
    console.log('order.company:', order.company);
    
    // Verificar campos brasileiros específicos
    console.log('=== CAMPOS BRASILEIROS ===');
    console.log('order.buyer_accepts_marketing:', order.buyer_accepts_marketing);
    console.log('order.checkout_token:', order.checkout_token);
    console.log('order.payment_gateway_names:', order.payment_gateway_names);
    console.log('order.processing_method:', order.processing_method);
    
    // Verificar customer fields
    if (order.customer) {
      console.log('customer.tax_exempt:', order.customer.tax_exempt);
      console.log('customer.tax_exemptions:', order.customer.tax_exemptions);
      console.log('customer.note:', order.customer.note);
      console.log('customer.tags:', order.customer.tags);
      console.log('customer.default_address:', JSON.stringify(order.customer.default_address));
    }

    // Verificar note_attributes em detalhe
    if (order.note_attributes && order.note_attributes.length > 0) {
      console.log('=== NOTE_ATTRIBUTES DETALHADO ===');
      order.note_attributes.forEach((attr: any, i: number) => {
        console.log(`[${i}] ${attr.name}: ${attr.value}`);
      });
    }

    // Tentar encontrar CPF/CNPJ em qualquer campo
    let cpfCnpj = null;
    let fonteEncontrada = null;

    // 1. Verificar note_attributes
    if (order.note_attributes) {
      const cpfAttr = order.note_attributes.find((attr: any) => 
        attr.name?.toLowerCase().includes('cpf') || 
        attr.name?.toLowerCase().includes('cnpj') ||
        attr.name?.toLowerCase().includes('document') ||
        attr.name?.toLowerCase().includes('tax')
      );
      if (cpfAttr) {
        cpfCnpj = cpfAttr.value;
        fonteEncontrada = `note_attributes.${cpfAttr.name}`;
      }
    }

    // 2. Verificar billing_address.company
    if (!cpfCnpj && order.billing_address?.company) {
      const company = order.billing_address.company;
      // Verificar se parece com CPF/CNPJ (apenas números)
      const numbersOnly = company.replace(/\D/g, '');
      if (numbersOnly.length === 11 || numbersOnly.length === 14) {
        cpfCnpj = numbersOnly;
        fonteEncontrada = 'billing_address.company';
      }
    }

    // 3. Verificar shipping_address.company
    if (!cpfCnpj && order.shipping_address?.company) {
      const company = order.shipping_address.company;
      const numbersOnly = company.replace(/\D/g, '');
      if (numbersOnly.length === 11 || numbersOnly.length === 14) {
        cpfCnpj = numbersOnly;
        fonteEncontrada = 'shipping_address.company';
      }
    }

    // 4. Verificar customer.note
    if (!cpfCnpj && order.customer?.note) {
      const note = order.customer.note;
      const numbersOnly = note.replace(/\D/g, '');
      if (numbersOnly.length === 11 || numbersOnly.length === 14) {
        cpfCnpj = numbersOnly;
        fonteEncontrada = 'customer.note';
      }
    }

    console.log('=== RESULTADO ===');
    console.log('CPF/CNPJ encontrado:', cpfCnpj);
    console.log('Fonte:', fonteEncontrada);

    // Salvar no banco se encontrou o pedido
    if (order.id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Tentar atualizar o customer_document se encontrou CPF/CNPJ
      if (cpfCnpj) {
        const { error } = await supabase
          .from('ebd_shopify_pedidos')
          .update({ customer_document: cpfCnpj })
          .eq('shopify_order_id', order.id);

        if (error) {
          console.log('Erro ao atualizar customer_document:', error);
        } else {
          console.log('customer_document atualizado com sucesso para order:', order.id);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      order_id: order.id,
      order_name: order.name,
      cpf_cnpj_encontrado: cpfCnpj,
      fonte: fonteEncontrada
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no webhook:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
