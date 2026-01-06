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
    const { order_id, order_number } = await req.json();
    
    const ACCESS_TOKEN = Deno.env.get('SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN');

    if (!ACCESS_TOKEN) {
      throw new Error('SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN not configured');
    }

    let order: any = null;

    // Primeiro tenta buscar pelo order_id
    if (order_id) {
      const orderUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/orders/${order_id}.json`;
      console.log('1a. Buscando pedido por ID:', orderUrl);
      
      const orderResponse = await fetch(orderUrl, {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      const orderData = await orderResponse.json();
      order = orderData.order;
    }

    // Se não encontrou por ID, tenta buscar pelo nome/número
    if (!order && order_number) {
      const searchUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/orders.json?name=${order_number}&status=any`;
      console.log('1b. Buscando pedido por número:', searchUrl);
      
      const searchResponse = await fetch(searchUrl, {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      });

      const searchData = await searchResponse.json();
      console.log('Pedidos encontrados:', searchData.orders?.length);
      order = searchData.orders?.[0];
    }

    if (!order) {
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404
      });
    }

    const orderId = order.id;

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
    const orderMetafieldsUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/orders/${orderId}/metafields.json`;
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

    // 4. Buscar checkout via REST (é onde o CPF/CNPJ brasileiro costuma ficar)
    let checkoutData: any = null;
    if (order.checkout_token) {
      const checkoutUrl = `https://${SHOP_DOMAIN}/admin/api/2024-01/checkouts/${order.checkout_token}.json`;
      console.log('4. Buscando checkout:', checkoutUrl);
      
      try {
        const checkoutResponse = await fetch(checkoutUrl, {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        });
        
        if (checkoutResponse.ok) {
          checkoutData = await checkoutResponse.json();
          console.log('Checkout data:', JSON.stringify(checkoutData, null, 2));
        } else {
          console.log('Checkout response status:', checkoutResponse.status);
        }
      } catch (e) {
        console.log('Error fetching checkout:', e);
      }
    }

    // 5. Buscar via GraphQL com TODOS os campos possíveis
    const graphqlUrl = `https://${SHOP_DOMAIN}/admin/api/2025-01/graphql.json`;
    const gid = `gid://shopify/Order/${orderId}`;
    
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
      checkout_data: checkoutData,
      // Retornar campos específicos para análise
      full_order: {
        customer: order.customer,
        billing_address: order.billing_address,
        shipping_address: order.shipping_address,
        note: order.note,
        note_attributes: order.note_attributes,
        tax_lines: order.tax_lines,
        tags: order.tags,
        custom_fields: order.custom_fields,
        additional_details: order.additional_details,
        checkout_id: order.checkout_id,
        checkout_token: order.checkout_token,
        source_name: order.source_name,
        source_identifier: order.source_identifier,
        payment_gateway_names: order.payment_gateway_names,
      },
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
