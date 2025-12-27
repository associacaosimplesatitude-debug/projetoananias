import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2024-01";

interface ShopifyLineItem {
  id: number;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
  sku: string | null;
  product_id: number | null;
  variant_id: number | null;
}

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
  line_items?: ShopifyLineItem[];
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

    // AuthZ: this function is public at the gateway level (verify_jwt=false) to allow CORS preflight,
    // but we still REQUIRE a valid user token + admin role for POST.
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(JSON.stringify({ success: false, error: "Role check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const financialStatus = body.financial_status || "paid";
    const status = body.status || "any";
    const createdAtMin = body.created_at_min as string | undefined;
    const createdAtMax = body.created_at_max as string | undefined;

    console.log(
      `Syncing orders with financial_status: ${financialStatus}, status: ${status}, created_at_min: ${createdAtMin ?? "-"}, created_at_max: ${createdAtMax ?? "-"}`
    );

    let allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;

    // Fetch orders with pagination
    do {
      const baseUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
      const url = pageInfo
        ? `${baseUrl}?limit=250&page_info=${pageInfo}`
        : (() => {
            const params = new URLSearchParams({
              limit: "250",
              status,
              financial_status: financialStatus,
            });
            if (createdAtMin) params.set("created_at_min", createdAtMin);
            if (createdAtMax) params.set("created_at_max", createdAtMax);
            return `${baseUrl}?${params.toString()}`;
          })();

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

    // Now sync line items for each order
    let totalItemsSynced = 0;
    
    for (const order of allOrders) {
      if (!order.line_items || order.line_items.length === 0) continue;

      // First, get the pedido_id from our database
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .select("id")
        .eq("shopify_order_id", order.id)
        .single();

      if (pedidoError || !pedidoData) {
        console.error(`Could not find pedido for shopify_order_id ${order.id}`);
        continue;
      }

      const itemsToUpsert = order.line_items.map((item) => ({
        pedido_id: pedidoData.id,
        shopify_line_item_id: item.id,
        product_title: item.title,
        variant_title: item.variant_title,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0,
        sku: item.sku,
      }));

      const { error: itemsError } = await supabase
        .from("ebd_shopify_pedidos_cg_itens")
        .upsert(itemsToUpsert, { onConflict: "shopify_line_item_id" });

      if (itemsError) {
        console.error(`Error upserting items for order ${order.name}:`, itemsError);
      } else {
        totalItemsSynced += itemsToUpsert.length;
      }
    }

    console.log(`Total line items synced: ${totalItemsSynced}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: ordersToUpsert.length,
        items_synced: totalItemsSynced,
        message: `Synced ${ordersToUpsert.length} orders and ${totalItemsSynced} line items from Central Gospel store`,
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
