import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHOP_DOMAIN = 'kgg1pq-6r.myshopify.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    
    const ACCESS_TOKEN = Deno.env.get('SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN');

    if (!ACCESS_TOKEN) {
      throw new Error('SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN not configured');
    }

    // 1. Buscar pedido via REST para pegar customer_id
    const orderUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/orders/${order_id}.json`;
    console.log('1. Buscando pedido:', orderUrl);
    
    const orderResponse = await fetch(orderUrl, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const orderData = await orderResponse.json();
    const order = orderData.order;
    
    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const customerId = order.customer?.id;
    console.log('Customer ID:', customerId);

    // 2. Buscar TODOS os metafields do customer via REST
    let customerMetafields: any[] = [];
    if (customerId) {
      const metafieldsUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/customers/${customerId}/metafields.json`;
      console.log('2. Buscando metafields do customer:', metafieldsUrl);
      
      const metafieldsResponse = await fetch(metafieldsUrl, {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      });
      
      const metafieldsData = await metafieldsResponse.json();
      customerMetafields = metafieldsData.metafields || [];
      console.log('Metafields do customer:', JSON.stringify(customerMetafields, null, 2));
    }

    // 3. Buscar metafields do ORDER
    const orderMetafieldsUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/orders/${order_id}/metafields.json`;
    console.log('3. Buscando metafields do order:', orderMetafieldsUrl);
    
    const orderMetafieldsResponse = await fetch(orderMetafieldsUrl, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
    });
    
    const orderMetafieldsData = await orderMetafieldsResponse.json();
    const orderMetafields = orderMetafieldsData.metafields || [];
    console.log('Metafields do order:', JSON.stringify(orderMetafields, null, 2));

    // 4. Buscar via GraphQL com TODOS os campos possíveis
    const graphqlUrl = `https://${SHOP_DOMAIN}/admin/api/2025-01/graphql.json`;
    const gid = `gid://shopify/Order/${order_id}`;
    
    const graphqlQuery = `
      query GetOrderFull($id: ID!) {
        order(id: $id) {
          id
          name
          note
          customAttributes {
            key
            value
          }
          metafields(first: 50) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
          }
          customer {
            id
            email
            taxExempt
            taxExemptions
            metafields(first: 50) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
          billingAddress {
            company
            address2
          }
          shippingAddress {
            company
            address2
          }
          purchasingEntity {
            ... on PurchasingCompany {
              company {
                name
                externalId
              }
            }
          }
        }
      }
    `;

    console.log('4. Buscando via GraphQL...');
    
    const graphqlResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: { id: gid },
      }),
    });

    const graphqlData = await graphqlResponse.json();
    console.log('GraphQL Response:', JSON.stringify(graphqlData, null, 2));

    // Procurar CPF/CNPJ em todos os lugares
    let cpfCnpjEncontrado = null;
    let fonteEncontrada = null;

    // Verificar metafields do customer
    for (const mf of customerMetafields) {
      if (mf.key?.toLowerCase().includes('cpf') || 
          mf.key?.toLowerCase().includes('cnpj') ||
          mf.key?.toLowerCase().includes('tax') ||
          mf.key?.toLowerCase().includes('document') ||
          mf.namespace?.toLowerCase().includes('tax')) {
        cpfCnpjEncontrado = mf.value;
        fonteEncontrada = `customer.metafield.${mf.namespace}.${mf.key}`;
        break;
      }
    }

    // Verificar metafields do order
    if (!cpfCnpjEncontrado) {
      for (const mf of orderMetafields) {
        if (mf.key?.toLowerCase().includes('cpf') || 
            mf.key?.toLowerCase().includes('cnpj') ||
            mf.key?.toLowerCase().includes('tax') ||
            mf.key?.toLowerCase().includes('document')) {
          cpfCnpjEncontrado = mf.value;
          fonteEncontrada = `order.metafield.${mf.namespace}.${mf.key}`;
          break;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: order.id,
      order_number: order.name,
      cpf_cnpj_encontrado: cpfCnpjEncontrado,
      fonte_encontrada: fonteEncontrada,
      customer_id: customerId,
      customer_metafields: customerMetafields,
      order_metafields: orderMetafields,
      graphql_data: graphqlData?.data,
      note_attributes: order.note_attributes,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
