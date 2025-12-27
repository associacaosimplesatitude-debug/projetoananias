// Shopify Storefront API Configuration
export const SHOPIFY_API_VERSION = '2025-07';
export const SHOPIFY_STORE_PERMANENT_DOMAIN = 'kgg1pq-6r.myshopify.com';
export const SHOPIFY_STOREFRONT_URL = `https://${SHOPIFY_STORE_PERMANENT_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`;
export const SHOPIFY_STOREFRONT_TOKEN = '19eceb1d7df9671211343510915855d2';

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

export async function storefrontApiRequest(query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(SHOPIFY_STOREFRONT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_STOREFRONT_TOKEN
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (response.status === 402) {
    throw new Error('Shopify API access requires an active Shopify billing plan.');
  }

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`Error calling Shopify: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  return data;
}

export async function fetchShopifyProducts(first: number = 250, query?: string): Promise<ShopifyProduct[]> {
  const allProducts: ShopifyProduct[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  
  // Buscar todos os produtos com paginação (máximo 250 por requisição)
  while (hasNextPage) {
    const data = await storefrontApiRequest(STOREFRONT_QUERY, { 
      first: Math.min(first, 250), // Shopify max is 250
      query,
      after: cursor 
    });
    
    const products = data.data.products.edges;
    const pageInfo = data.data.products.pageInfo;
    
    allProducts.push(...products);
    
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
    
    // Se já buscamos o suficiente, parar
    if (allProducts.length >= first) {
      hasNextPage = false;
    }
  }
  
  return allProducts;
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

  // Build input with optional buyer identity
  const input: Record<string, unknown> = { lines };
  
  if (buyerInfo) {
    const buyerIdentity: Record<string, unknown> = {};
    
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
    
    if (Object.keys(buyerIdentity).length > 0) {
      input.buyerIdentity = buyerIdentity;
    }
  }

  const cartData = await storefrontApiRequest(CART_CREATE_MUTATION, { input });

  if (cartData.data.cartCreate.userErrors.length > 0) {
    throw new Error(`Cart creation failed: ${cartData.data.cartCreate.userErrors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  const cart = cartData.data.cartCreate.cart;
  
  if (!cart.checkoutUrl) {
    throw new Error('No checkout URL returned from Shopify');
  }

  const url = new URL(cart.checkoutUrl);
  url.searchParams.set('channel', 'online_store');
  return url.toString();
}
