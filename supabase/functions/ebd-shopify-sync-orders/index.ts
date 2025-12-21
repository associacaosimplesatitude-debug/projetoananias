import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "editoraananias.myshopify.com";
const SHOPIFY_API_VERSION = "2024-01";

type ShopifyOrder = {
  id: number;
  name: string;
  financial_status: string;
  created_at: string;
  updated_at: string;
  email: string | null;
  customer: { first_name: string | null; last_name: string | null; email: string | null } | null;
  tags: string | null;
  note_attributes?: Array<{ name: string; value: string }>;
  total_price: string;
  shipping_lines?: Array<{ price: string }>;
};

function getNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  // Example: <https://.../orders.json?limit=250&page_info=xxxxx>; rel="next"
  const parts = linkHeader.split(",").map((p) => p.trim());
  for (const part of parts) {
    if (!part.includes('rel="next"')) continue;
    const matchUrl = part.match(/<([^>]+)>/);
    if (!matchUrl?.[1]) continue;
    try {
      const url = new URL(matchUrl[1]);
      return url.searchParams.get("page_info");
    } catch {
      return null;
    }
  }

  return null;
}

function extractIds(order: ShopifyOrder): { vendedorId: string | null; clienteId: string | null } {
  let vendedorId: string | null = null;
  let clienteId: string | null = null;

  if (order.note_attributes && Array.isArray(order.note_attributes)) {
    for (const attr of order.note_attributes) {
      if (attr?.name === "vendedor_id") vendedorId = attr.value;
      if (attr?.name === "cliente_id") clienteId = attr.value;
    }
  }

  if (!vendedorId && order.tags) {
    const tagMatch = order.tags.match(/vendedor_([a-f0-9-]+)/i);
    if (tagMatch) vendedorId = tagMatch[1];
  }

  return { vendedorId, clienteId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
    if (!SHOPIFY_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Shopify not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Defaults: sync ALL PAID orders since store start
    const body = (await req.json().catch(() => ({}))) as {
      financial_status?: string; // paid | any
      status?: string; // open | closed | any
    };

    const financialStatus = body.financial_status ?? "paid";
    const status = body.status ?? "any";

    console.log("Starting Shopify orders sync", { financialStatus, status });

    const allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;

    // Shopify REST pagination via Link header
    for (let i = 0; i < 100; i++) {
      const url = new URL(`https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json`);
      url.searchParams.set("limit", "250");
      url.searchParams.set("status", status);
      url.searchParams.set("financial_status", financialStatus);
      url.searchParams.set("order", "created_at asc");

      if (pageInfo) url.searchParams.set("page_info", pageInfo);

      console.log("Fetching orders page", { i, pageInfo });

      const resp = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      });

      if (!resp.ok) {
        const text = await resp.text();
        console.error("Failed to fetch orders", resp.status, text);
        return new Response(JSON.stringify({ error: "Failed to fetch orders", status: resp.status, details: text }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = (await resp.json()) as { orders: ShopifyOrder[] };
      const orders = payload.orders ?? [];
      allOrders.push(...orders);

      const next = getNextPageInfo(resp.headers.get("link"));
      if (!next || orders.length === 0) break;
      pageInfo = next;
    }

    console.log("Orders fetched", { count: allOrders.length });

    if (allOrders.length === 0) {
      return new Response(JSON.stringify({ success: true, synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows = allOrders.map((order) => {
      const { vendedorId, clienteId } = extractIds(order);

      const valorFrete = order.shipping_lines && order.shipping_lines.length > 0 ? parseFloat(order.shipping_lines[0].price) : 0;
      const valorTotal = parseFloat(order.total_price);
      const valorParaMeta = valorTotal - valorFrete;

      const customerName = order.customer
        ? `${order.customer.first_name ?? ""} ${order.customer.last_name ?? ""}`.trim() || null
        : null;

      return {
        shopify_order_id: order.id,
        order_number: order.name,
        vendedor_id: vendedorId,
        cliente_id: clienteId,
        status_pagamento: order.financial_status, // keep canonical Shopify status
        valor_total: valorTotal,
        valor_frete: valorFrete,
        valor_para_meta: valorParaMeta,
        customer_email: order.email || order.customer?.email || null,
        customer_name: customerName,
        created_at: order.created_at,
        updated_at: order.updated_at,
      };
    });

    const { error } = await supabase
      .from("ebd_shopify_pedidos")
      .upsert(rows, { onConflict: "shopify_order_id", ignoreDuplicates: false });

    if (error) {
      console.error("Error upserting orders", error);
      return new Response(JSON.stringify({ error: "Failed to save orders", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, synced: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Sync error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
