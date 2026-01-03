// Shopify Storefront API Configuration
// Loja principal (única) usada pelo sistema: kgg1pq-6r.myshopify.com
// O token é armazenado em secret e usado via edge function
import { supabase } from "@/integrations/supabase/client";

export const SHOPIFY_API_VERSION = '2025-07';
export const SHOPIFY_STORE_PERMANENT_DOMAIN = 'kgg1pq-6r.myshopify.com';
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;

export interface ShopifyProduct {
  node: {
    id: string;
    title: string;
    description: string;
    handle: string;
    priceRange: {
      minVariantPrice: {
        amount: string;
        currencyCode: string;
      };
    };
    images: {
      edges: Array<{
        node: {
          url: string;
          altText: string | null;
        };
      }>;
    };
    variants: {
      edges: Array<{
        node: {
          id: string;
          title: string;
          sku: string | null;
          price: {
            amount: string;
            currencyCode: string;
          };
          availableForSale: boolean;
          selectedOptions: Array<{
            name: string;
            value: string;
          }>;
        };
      }>;
    };
    options: Array<{
      name: string;
      values: string[];
    }>;
  };
}

export interface CartItem {
  product: ShopifyProduct;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  price: {
    amount: string;
    currencyCode: string;
  };
  quantity: number;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

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

// Buscar produtos via Edge Function (usa token do secret)
export async function fetchShopifyProducts(first: number = 250, query?: string): Promise<ShopifyProduct[]> {
  const { data, error } = await supabase.functions.invoke('shopify-storefront-products', {
    body: { first, query }
  });
  
  if (error) {
    console.error('Error fetching Shopify products:', error);
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }
  
  if (!data.success) {
    throw new Error(data.error || 'Erro desconhecido ao buscar produtos');
  }
  
  return data.products || [];
}

export interface BuyerInfo {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  address?: {
    address1?: string | null;
    address2?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
    country?: string;
  } | null;
}

export async function createStorefrontCheckout(items: CartItem[], buyerInfo?: BuyerInfo): Promise<string> {
  const lines = items.map(item => ({
    quantity: item.quantity,
    merchandiseId: item.variantId,
  }));

  // Build buyer identity if provided
  let buyerIdentity: Record<string, unknown> | undefined;
  
  if (buyerInfo) {
    buyerIdentity = {};
    
    if (buyerInfo.email) {
      buyerIdentity.email = buyerInfo.email;
    }
    if (buyerInfo.phone) {
      buyerIdentity.phone = buyerInfo.phone;
    }
    
    // Add delivery address preferences if available
    if (buyerInfo.address) {
      buyerIdentity.deliveryAddressPreferences = [{
        deliveryAddress: {
          address1: buyerInfo.address.address1 || '',
          address2: buyerInfo.address.address2 || '',
          city: buyerInfo.address.city || '',
          province: buyerInfo.address.province || '',
          zip: buyerInfo.address.zip || '',
          country: buyerInfo.address.country || 'BR',
          firstName: buyerInfo.firstName || '',
          lastName: buyerInfo.lastName || '',
          phone: buyerInfo.phone || '',
        }
      }];
    }
    
    if (Object.keys(buyerIdentity).length === 0) {
      buyerIdentity = undefined;
    }
  }

  const { data, error } = await supabase.functions.invoke('shopify-storefront-checkout', {
    body: { lines, buyerIdentity }
  });

  if (error) {
    console.error('Error creating checkout:', error);
    throw new Error(`Erro ao criar checkout: ${error.message}`);
  }

  if (!data.success) {
    const errorMessage = data.error || 'Erro desconhecido';
    
    // Check for common Shopify errors
    if (errorMessage.toLowerCase().includes('no longer available') || 
        errorMessage.toLowerCase().includes('not available') ||
        errorMessage.toLowerCase().includes('out of stock')) {
      throw new Error('Um ou mais produtos no carrinho não estão mais disponíveis. Por favor, remova os itens indisponíveis e tente novamente.');
    }
    
    throw new Error(errorMessage);
  }

  return data.checkoutUrl;
}
