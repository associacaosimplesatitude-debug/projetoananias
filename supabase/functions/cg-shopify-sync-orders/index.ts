import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2024-01";

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  financial_status: string;
  total_price: string;
  total_shipping_price_set?: {
    shop_money?: {
      amount: string;
    };
  };
  shipping_lines?: Array<{
    price: string;
  }>;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
  fulfillments?: Array<{
    tracking_number?: string;
    tracking_url?: string;
  }>;
  created_at: string;
}

function getNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const matches = linkHeader.match(/<[^>]+page_info=([^>&]+)[^>]*>;\s*rel="next"/);
  return matches ? matches[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAccessToken = Deno.env.get("SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!shopifyAccessToken || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json().catch(() => ({}));
    const financialStatus = body.financial_status || "paid";
    const status = body.status || "any";

    console.log(`Syncing orders with financial_status: ${financialStatus}, status: ${status}`);

    let allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;

    // Fetch orders with pagination
    do {
      const url = pageInfo
        ? `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&page_info=${pageInfo}`
        : `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?limit=250&status=${status}&financial_status=${financialStatus}`;

      console.log(`Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": shopifyAccessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      allOrders = allOrders.concat(data.orders || []);

      const linkHeader = response.headers.get("Link");
      pageInfo = getNextPageInfo(linkHeader);

      console.log(`Fetched ${data.orders?.length || 0} orders, total: ${allOrders.length}`);
    } while (pageInfo);

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Process and upsert orders
    const ordersToUpsert = allOrders.map((order) => {
      const shippingPrice =
        order.total_shipping_price_set?.shop_money?.amount ||
        order.shipping_lines?.[0]?.price ||
        "0";

      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
        : "";

      const tracking = order.fulfillments?.[0];

      return {
        shopify_order_id: order.id,
        order_number: order.name,
        status_pagamento: order.financial_status,
        customer_email: order.customer?.email || order.email,
        customer_name: customerName,
        valor_total: parseFloat(order.total_price) || 0,
        valor_frete: parseFloat(shippingPrice) || 0,
        codigo_rastreio: tracking?.tracking_number || null,
        url_rastreio: tracking?.tracking_url || null,
        // IMPORTANT: use Shopify's real order date for metrics
        order_date: order.created_at,
        // Keep created_at aligned to the real order date as well (legacy screens still use created_at)
        created_at: order.created_at,
        updated_at: new Date().toISOString(),
      };
    });

    if (ordersToUpsert.length > 0) {
      const { error } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .upsert(ordersToUpsert, { onConflict: "shopify_order_id" });

      if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: ordersToUpsert.length,
        message: `Synced ${ordersToUpsert.length} orders from Central Gospel store`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing orders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
