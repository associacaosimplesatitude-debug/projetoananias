// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// LOJA CORRETA - kgg1pq-6r.myshopify.com
const SHOPIFY_STORE = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

const STOREFRONT_QUERY = `
  query GetProducts($first: Int!, $query: String, $after: String) {
    products(first: $first, query: $query, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          description
          handle
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 5) {
            edges {
              node {
                url
                altText
              }
            }
          }
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price {
                  amount
                  currencyCode
                }
                availableForSale
                weight
                weightUnit
                selectedOptions {
                  name
                  value
                }
              }
            }
          }
          options {
            name
            values
          }
        }
      }
    }
  }
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const storefrontToken = Deno.env.get("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
    
    if (!storefrontToken) {
      throw new Error("SHOPIFY_STOREFRONT_ACCESS_TOKEN not configured");
    }

    const { first = 250, query, after } = await req.json().catch(() => ({}));

    const allProducts: any[] = [];
    let hasNextPage = true;
    let cursor = after || null;
    const maxProducts = first;

    while (hasNextPage && allProducts.length < maxProducts) {
      const response = await fetch(
        `https://${SHOPIFY_STORE}/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Storefront-Access-Token": storefrontToken,
          },
          body: JSON.stringify({
            query: STOREFRONT_QUERY,
            variables: {
              first: Math.min(250, maxProducts - allProducts.length),
              query: query || null,
              after: cursor,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Shopify API error:", response.status, errorText);
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.error("Shopify GraphQL errors:", data.errors);
        throw new Error(`Shopify GraphQL error: ${data.errors.map((e: any) => e.message).join(", ")}`);
      }

      const products = data.data?.products?.edges || [];
      const pageInfo = data.data?.products?.pageInfo || {};

      allProducts.push(...products);
      hasNextPage = pageInfo.hasNextPage && allProducts.length < maxProducts;
      cursor = pageInfo.endCursor;
    }

    return new Response(
      JSON.stringify({ products: allProducts, success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching products:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
