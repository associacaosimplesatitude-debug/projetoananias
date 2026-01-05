import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

type ShopifyLineItem = {
  id: number;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  price: string;
  total_discount: string;
  product_id: number | null;
  variant_id: number | null;
};

type ShopifyOrder = {
  id: number;
  name: string;
  line_items: ShopifyLineItem[];
};

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

    const body = (await req.json().catch(() => ({}))) as {
      pedido_id?: string; // UUID interno do Supabase
      shopify_order_id?: number | string; // ID do Shopify
    };

    const { pedido_id, shopify_order_id } = body;

    if (!pedido_id && !shopify_order_id) {
      return new Response(
        JSON.stringify({ error: "Informe pedido_id ou shopify_order_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Buscar o pedido no banco para obter shopify_order_id
    let orderData: { id: string; shopify_order_id: number } | null = null;

    if (pedido_id) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id")
        .eq("id", pedido_id)
        .single();
      
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Pedido não encontrado", details: error?.message }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      orderData = data;
    } else if (shopify_order_id) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id")
        .eq("shopify_order_id", shopify_order_id)
        .single();
      
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Pedido não encontrado com esse shopify_order_id", details: error?.message }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      orderData = data;
    }

    if (!orderData) {
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Syncing items for order ${orderData.shopify_order_id}`);

    // 2. Buscar pedido na Shopify
    const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders/${orderData.shopify_order_id}.json?fields=id,name,line_items`;
    
    const resp = await fetch(shopifyUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Failed to fetch order from Shopify", resp.status, text);
      return new Response(
        JSON.stringify({ error: "Falha ao buscar pedido na Shopify", status: resp.status, details: text }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload = (await resp.json()) as { order: ShopifyOrder };
    const order = payload.order;

    if (!order.line_items || order.line_items.length === 0) {
      return new Response(
        JSON.stringify({ success: true, items_synced: 0, message: "Pedido sem itens" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Preparar e inserir itens
    const itemRows = order.line_items.map((item) => ({
      pedido_id: orderData!.id,
      shopify_line_item_id: item.id,
      product_title: item.title,
      variant_title: item.variant_title || null,
      sku: item.sku || null,
      quantity: item.quantity,
      price: parseFloat(item.price),
      total_discount: parseFloat(item.total_discount || "0"),
    }));

    console.log(`Upserting ${itemRows.length} items for pedido ${orderData.id}`);

    const { error: upsertError, data: upsertData } = await supabase
      .from("ebd_shopify_pedidos_itens")
      .upsert(itemRows, { onConflict: "pedido_id,shopify_line_item_id", ignoreDuplicates: false })
      .select("id");

    if (upsertError) {
      console.error("Error upserting items", upsertError);
      return new Response(
        JSON.stringify({ error: "Falha ao salvar itens", details: upsertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Successfully synced ${upsertData?.length || itemRows.length} items`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        items_synced: upsertData?.length || itemRows.length,
        pedido_id: orderData.id,
        order_number: order.name 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
