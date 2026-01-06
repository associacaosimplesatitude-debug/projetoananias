import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id } = await req.json();
    
    const SHOPIFY_STORE = Deno.env.get("SHOPIFY_STORE_DOMAIN") || "central-gospel-music.myshopify.com";
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
    
    if (!SHOPIFY_ACCESS_TOKEN) {
      throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN not configured");
    }

    // Fetch order with all fields
    const orderUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/orders/${order_id}.json`;
    console.log("Fetching order from:", orderUrl);

    const orderResponse = await fetch(orderUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      console.error("Shopify error:", errorText);
      throw new Error(`Shopify API error: ${orderResponse.status} - ${errorText}`);
    }

    const orderData = await orderResponse.json();
    const order = orderData.order;

    // Extract relevant fields for debugging
    const debugInfo = {
      order_id: order.id,
      order_number: order.order_number,
      name: order.name,
      email: order.email,
      phone: order.phone,
      note: order.note,
      note_attributes: order.note_attributes,
      customer: order.customer ? {
        id: order.customer.id,
        email: order.customer.email,
        phone: order.customer.phone,
        first_name: order.customer.first_name,
        last_name: order.customer.last_name,
        note: order.customer.note,
        tax_exempt: order.customer.tax_exempt,
        tags: order.customer.tags,
        default_address: order.customer.default_address,
      } : null,
      billing_address: order.billing_address,
      shipping_address: order.shipping_address,
      tags: order.tags,
      // Full order for complete analysis
      full_order: order,
    };

    console.log("=== DEBUG ORDER PAYLOAD ===");
    console.log("Order Number:", order.order_number);
    console.log("Note:", order.note);
    console.log("Note Attributes:", JSON.stringify(order.note_attributes, null, 2));
    console.log("Billing Address:", JSON.stringify(order.billing_address, null, 2));
    console.log("Shipping Address:", JSON.stringify(order.shipping_address, null, 2));
    console.log("Customer:", JSON.stringify(order.customer, null, 2));
    console.log("Tags:", order.tags);

    // Also fetch order metafields
    const metafieldsUrl = `https://${SHOPIFY_STORE}/admin/api/2025-01/orders/${order_id}/metafields.json`;
    const metafieldsResponse = await fetch(metafieldsUrl, {
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    let metafields = [];
    if (metafieldsResponse.ok) {
      const metafieldsData = await metafieldsResponse.json();
      metafields = metafieldsData.metafields || [];
      console.log("Metafields:", JSON.stringify(metafields, null, 2));
    }

    return new Response(JSON.stringify({
      success: true,
      debug_info: debugInfo,
      metafields: metafields,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error:", errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
