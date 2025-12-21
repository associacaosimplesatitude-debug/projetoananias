import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
};

interface ShopifyOrder {
  id: number;
  order_number: number;
  name: string;
  email: string;
  financial_status: string;
  fulfillment_status: string | null;
  fulfillments?: Array<{
    id: number;
    status: string;
    tracking_number: string | null;
    tracking_url: string | null;
    tracking_numbers: string[];
    tracking_urls: string[];
  }>;
  total_price: string;
  subtotal_price: string;
  total_tax: string;
  total_discounts: string;
  shipping_lines: Array<{
    id: number;
    title: string;
    price: string;
  }>;
  note_attributes: Array<{
    name: string;
    value: string;
  }>;
  tags: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  created_at: string;
  updated_at: string;
}

// Function to fetch fulfillment data from Shopify
async function fetchFulfillmentData(orderId: number): Promise<{ trackingNumber: string | null; trackingUrl: string | null }> {
  const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const SHOPIFY_STORE_DOMAIN = "editoraananias.myshopify.com";
  
  if (!SHOPIFY_ACCESS_TOKEN) {
    console.log("SHOPIFY_ADMIN_ACCESS_TOKEN not set, skipping fulfillment fetch");
    return { trackingNumber: null, trackingUrl: null };
  }
  
  try {
    const response = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders/${orderId}/fulfillments.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (!response.ok) {
      console.error("Failed to fetch fulfillments:", response.status, await response.text());
      return { trackingNumber: null, trackingUrl: null };
    }
    
    const data = await response.json();
    const fulfillments = data.fulfillments || [];
    
    if (fulfillments.length > 0) {
      const latestFulfillment = fulfillments[fulfillments.length - 1];
      return {
        trackingNumber: latestFulfillment.tracking_number || latestFulfillment.tracking_numbers?.[0] || null,
        trackingUrl: latestFulfillment.tracking_url || latestFulfillment.tracking_urls?.[0] || null,
      };
    }
    
    return { trackingNumber: null, trackingUrl: null };
  } catch (error) {
    console.error("Error fetching fulfillments:", error);
    return { trackingNumber: null, trackingUrl: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create Supabase client with service role for writing data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get webhook topic from header
    const topic = req.headers.get("x-shopify-topic");
    const shopDomain = req.headers.get("x-shopify-shop-domain");
    
    console.log("Received Shopify webhook:", { topic, shopDomain });

    // Parse the order payload
    const order: ShopifyOrder = await req.json();
    
    console.log("Order received:", {
      id: order.id,
      order_number: order.order_number,
      name: order.name,
      financial_status: order.financial_status,
      total_price: order.total_price,
      tags: order.tags,
      note_attributes: order.note_attributes,
    });

    // Keep canonical Shopify financial_status in the DB (UI will localize labels)
    const statusPagamento = order.financial_status;
    console.log("Order financial_status:", order.financial_status, "-> saved as:", statusPagamento);

    // Extract vendedor_id and cliente_id from note_attributes
    let vendedorId: string | null = null;
    let clienteId: string | null = null;

    if (order.note_attributes && Array.isArray(order.note_attributes)) {
      for (const attr of order.note_attributes) {
        if (attr.name === "vendedor_id") {
          vendedorId = attr.value;
        }
        if (attr.name === "cliente_id") {
          clienteId = attr.value;
        }
      }
    }

    // Also try to extract from tags (backup method)
    if (!vendedorId && order.tags) {
      const tagMatch = order.tags.match(/vendedor_([a-f0-9-]+)/i);
      if (tagMatch) {
        vendedorId = tagMatch[1];
      }
    }

    console.log("Extracted IDs:", { vendedorId, clienteId });

    // Fetch fulfillment data (tracking info)
    const { trackingNumber, trackingUrl } = await fetchFulfillmentData(order.id);
    console.log("Fulfillment data:", { trackingNumber, trackingUrl });

    // Also check if tracking is in the order payload (from fulfillments array)
    let finalTrackingNumber = trackingNumber;
    let finalTrackingUrl = trackingUrl;
    
    if (!finalTrackingNumber && order.fulfillments && order.fulfillments.length > 0) {
      const latestFulfillment = order.fulfillments[order.fulfillments.length - 1];
      finalTrackingNumber = latestFulfillment.tracking_number || latestFulfillment.tracking_numbers?.[0] || null;
      finalTrackingUrl = latestFulfillment.tracking_url || latestFulfillment.tracking_urls?.[0] || null;
    }

    // Calculate shipping value
    const valorFrete = order.shipping_lines && order.shipping_lines.length > 0
      ? parseFloat(order.shipping_lines[0].price)
      : 0;

    const valorTotal = parseFloat(order.total_price);
    const valorParaMeta = valorTotal - valorFrete;

    // Upsert the order in our database
    const orderData = {
      shopify_order_id: order.id,
      order_number: order.name,
      vendedor_id: vendedorId,
      cliente_id: clienteId,
      status_pagamento: statusPagamento,
      valor_total: valorTotal,
      valor_frete: valorFrete,
      valor_para_meta: valorParaMeta,
      customer_email: order.email || order.customer?.email || null,
      customer_name: order.customer 
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim() 
        : null,
      codigo_rastreio: finalTrackingNumber,
      url_rastreio: finalTrackingUrl,
      updated_at: new Date().toISOString(),
    };

    console.log("Upserting order data:", orderData);

    const { data, error } = await supabase
      .from("ebd_shopify_pedidos")
      .upsert(orderData, { 
        onConflict: "shopify_order_id",
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error("Error upserting order:", error);
      return new Response(
        JSON.stringify({ error: "Failed to save order", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Order saved successfully:", data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Order synced successfully",
        order_id: order.id,
        vendedor_id: vendedorId,
        valor_para_meta: valorParaMeta,
        tracking_number: finalTrackingNumber,
        tracking_url: finalTrackingUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
