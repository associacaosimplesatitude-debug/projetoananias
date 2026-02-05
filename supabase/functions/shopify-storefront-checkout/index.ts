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

const CART_CREATE_MUTATION = `
  mutation cartCreate($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
        totalQuantity
        cost {
          totalAmount {
            amount
            currencyCode
          }
        }
        lines(first: 100) {
          edges {
            node {
              id
              quantity
              merchandise {
                ... on ProductVariant {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  product {
                    title
                    handle
                  }
                }
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Format phone number to E.164 format for Shopify
function formatPhoneToE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-numeric characters
  const digits = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return null
  if (!digits) return null;
  
  // If already has country code (starts with 55 and has 12-13 digits), add +
  if (digits.length >= 12 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  
  // Brazilian phone: add +55 prefix
  // Mobile: 11 digits (2 area + 9 mobile)
  // Landline: 10 digits (2 area + 8 landline)
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  
  // If has 8-9 digits (no area code), we can't format properly, return null
  if (digits.length < 10) {
    console.log("Phone too short, skipping:", digits);
    return null;
  }
  
  // For other cases, just add + prefix
  return `+${digits}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const storefrontToken = Deno.env.get("SHOPIFY_STOREFRONT_ACCESS_TOKEN");
    
    if (!storefrontToken) {
      throw new Error("SHOPIFY_STOREFRONT_ACCESS_TOKEN not configured");
    }

    const { lines, buyerIdentity } = await req.json();

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      throw new Error("Cart lines are required");
    }

    const input: Record<string, unknown> = { lines };
    
    if (buyerIdentity && Object.keys(buyerIdentity).length > 0) {
      // Format phone numbers to E.164 format
      const formattedBuyerIdentity = { ...buyerIdentity };
      
      // Format main phone
      if (formattedBuyerIdentity.phone) {
        const formattedPhone = formatPhoneToE164(formattedBuyerIdentity.phone);
        if (formattedPhone) {
          formattedBuyerIdentity.phone = formattedPhone;
        } else {
          delete formattedBuyerIdentity.phone;
        }
      }
      
      // Format phone in delivery address
      if (formattedBuyerIdentity.deliveryAddressPreferences) {
        formattedBuyerIdentity.deliveryAddressPreferences = formattedBuyerIdentity.deliveryAddressPreferences.map((pref: any) => {
          if (pref.deliveryAddress?.phone) {
            const formattedPhone = formatPhoneToE164(pref.deliveryAddress.phone);
            return {
              ...pref,
              deliveryAddress: {
                ...pref.deliveryAddress,
                phone: formattedPhone || undefined
              }
            };
          }
          return pref;
        });
      }
      
      console.log("Formatted buyer identity:", JSON.stringify(formattedBuyerIdentity));
      input.buyerIdentity = formattedBuyerIdentity;
    }

    const response = await fetch(
      `https://${SHOPIFY_STORE}/api/${SHOPIFY_API_VERSION}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontToken,
        },
        body: JSON.stringify({
          query: CART_CREATE_MUTATION,
          variables: { input },
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

    const cartData = data.data?.cartCreate;

    if (cartData?.userErrors?.length > 0) {
      const errorMessages = cartData.userErrors.map((e: any) => e.message);
      throw new Error(`Cart creation failed: ${errorMessages.join(", ")}`);
    }

    const cart = cartData?.cart;
    
    if (!cart?.checkoutUrl) {
      throw new Error("No checkout URL returned from Shopify");
    }

    // Add channel parameter to checkout URL
    const url = new URL(cart.checkoutUrl);
    url.searchParams.set('channel', 'online_store');

    return new Response(
      JSON.stringify({ 
        checkoutUrl: url.toString(), 
        cart,
        success: true 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error("Error creating checkout:", error);
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
