import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";

// Query MUITO EXPANDIDA para descobrir onde está o CPF/CNPJ
const DEBUG_ORDER_QUERY = `
  query GetOrderFullStructure($id: ID!) {
    order(id: $id) {
      id
      name
      email
      phone
      note
      tags
      
      # Custom attributes do checkout
      customAttributes {
        key
        value
      }
      
      # CAMPO ESPECÍFICO BRASIL - Tax Identifier
      billingAddressMatchesShippingAddress
      
      # Dados do cliente - EXPANDIDO
      customer {
        id
        email
        phone
        firstName
        lastName
        note
        tags
        taxExempt
        taxExemptions
        defaultAddress {
          id
          firstName
          lastName
          company
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        addresses(first: 5) {
          id
          firstName
          lastName
          company
          address1
          address2
          city
          province
          country
          zip
          phone
        }
        metafields(first: 20) {
          edges {
            node {
              key
              namespace
              value
              type
            }
          }
        }
      }
      
      # Endereço de cobrança - TODOS OS CAMPOS
      billingAddress {
        id
        firstName
        lastName
        name
        company
        address1
        address2
        city
        province
        provinceCode
        country
        countryCodeV2
        zip
        phone
        latitude
        longitude
      }
      
      # Endereço de entrega
      shippingAddress {
        id
        firstName
        lastName
        name
        company
        address1
        address2
        city
        province
        provinceCode
        country
        countryCodeV2
        zip
        phone
      }
      
      # Metafields do pedido (pode estar aqui!)
      metafields(first: 50) {
        edges {
          node {
            key
            namespace
            value
            type
          }
        }
      }
      
      # Purchasing entity (B2B)
      purchasingEntity {
        ... on PurchasingCompany {
          company {
            name
            externalId
          }
        }
      }
      
      # Discounts e outros
      discountApplications(first: 5) {
        edges {
          node {
            ... on DiscountCodeApplication {
              code
            }
          }
        }
      }
      
      # Line items com propriedades customizadas
      lineItems(first: 5) {
        edges {
          node {
            id
            title
            customAttributes {
              key
              value
            }
          }
        }
      }
    }
  }
`;

// Query alternativa usando REST para comparar
async function fetchOrderViaRest(shopifyAccessToken: string, orderId: number) {
  const restUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${orderId}.json`;
  
  const response = await fetch(restUrl, {
    headers: {
      'X-Shopify-Access-Token': shopifyAccessToken,
    },
  });

  if (!response.ok) {
    return { error: `REST API error: ${response.status}` };
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAccessToken = Deno.env.get("SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN");
    if (!shopifyAccessToken) {
      throw new Error("SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN não configurado");
    }

    const { order_id } = await req.json();
    
    if (!order_id) {
      throw new Error("order_id é obrigatório");
    }

    const gid = `gid://shopify/Order/${order_id}`;
    const graphqlUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`;

    console.log(`[DEBUG] Buscando estrutura completa do pedido ${order_id}...`);

    // Buscar via GraphQL
    const graphqlResponse = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': shopifyAccessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: DEBUG_ORDER_QUERY,
        variables: { id: gid },
      }),
    });

    const graphqlJson = await graphqlResponse.json();

    // Buscar via REST também para comparar
    const restJson = await fetchOrderViaRest(shopifyAccessToken, order_id);

    console.log("=".repeat(80));
    console.log("[DEBUG] GRAPHQL RESPONSE:");
    console.log(JSON.stringify(graphqlJson, null, 2));
    console.log("=".repeat(80));
    console.log("[DEBUG] REST RESPONSE:");
    console.log(JSON.stringify(restJson, null, 2));
    console.log("=".repeat(80));

    // Análise automática mais completa
    const analysis: string[] = [];
    const order = graphqlJson.data?.order;
    const restOrder = restJson.order;

    if (order) {
      // Check customAttributes
      if (order.customAttributes?.length > 0) {
        analysis.push(`[GraphQL] customAttributes: ${JSON.stringify(order.customAttributes)}`);
      } else {
        analysis.push("[GraphQL] customAttributes: VAZIO");
      }

      // Check metafields do pedido
      if (order.metafields?.edges?.length > 0) {
        analysis.push(`[GraphQL] order.metafields: ${JSON.stringify(order.metafields.edges.map((e: any) => e.node))}`);
      } else {
        analysis.push("[GraphQL] order.metafields: VAZIO");
      }

      // Check customer metafields
      if (order.customer?.metafields?.edges?.length > 0) {
        analysis.push(`[GraphQL] customer.metafields: ${JSON.stringify(order.customer.metafields.edges.map((e: any) => e.node))}`);
      } else {
        analysis.push("[GraphQL] customer.metafields: VAZIO");
      }

      // Check line items customAttributes
      const lineItemAttrs = order.lineItems?.edges?.flatMap((e: any) => e.node.customAttributes || []) || [];
      if (lineItemAttrs.length > 0) {
        analysis.push(`[GraphQL] lineItems.customAttributes: ${JSON.stringify(lineItemAttrs)}`);
      }

      // Check billingAddress
      if (order.billingAddress) {
        analysis.push(`[GraphQL] billingAddress.company: "${order.billingAddress.company || 'null'}"`);
        analysis.push(`[GraphQL] billingAddress.address2: "${order.billingAddress.address2 || 'null'}"`);
      }

      // Check customer addresses
      if (order.customer?.addresses?.length > 0) {
        analysis.push(`[GraphQL] customer.addresses: ${JSON.stringify(order.customer.addresses)}`);
      }
    }

    // Análise do REST
    if (restOrder) {
      // Check note_attributes
      if (restOrder.note_attributes?.length > 0) {
        analysis.push(`[REST] note_attributes: ${JSON.stringify(restOrder.note_attributes)}`);
      } else {
        analysis.push("[REST] note_attributes: VAZIO");
      }

      // Check customer
      if (restOrder.customer) {
        const cust = restOrder.customer;
        analysis.push(`[REST] customer.tax_exempt: ${cust.tax_exempt}`);
        if (cust.tax_exemptions?.length > 0) {
          analysis.push(`[REST] customer.tax_exemptions: ${JSON.stringify(cust.tax_exemptions)}`);
        }
        if (cust.default_address) {
          analysis.push(`[REST] customer.default_address.company: "${cust.default_address.company || 'null'}"`);
        }
      }

      // Check all fields that might contain CPF/CNPJ patterns
      const jsonString = JSON.stringify(restOrder);
      const cpfPattern = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
      const cnpjPattern = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
      
      const cpfMatches = jsonString.match(cpfPattern);
      const cnpjMatches = jsonString.match(cnpjPattern);
      
      if (cpfMatches) {
        analysis.push(`[REST] PADRÃO CPF ENCONTRADO: ${JSON.stringify([...new Set(cpfMatches)])}`);
      }
      if (cnpjMatches) {
        analysis.push(`[REST] PADRÃO CNPJ ENCONTRADO: ${JSON.stringify([...new Set(cnpjMatches)])}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id,
        graphql_response: graphqlJson,
        rest_response: restJson,
        analysis,
        message: "Verifique os logs do Edge Function para a estrutura completa"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[DEBUG] Erro:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
