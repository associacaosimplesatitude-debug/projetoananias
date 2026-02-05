// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
      batch_size?: number; // Quantidade de pedidos por execução (padrão: 20)
    };

    const batchSize = body.batch_size || 20;

    console.log(`Starting backfill with batch size ${batchSize}`);

    // 1. Buscar pedidos que NÃO possuem itens na tabela ebd_shopify_pedidos_itens
    // Buscar todos os pedidos
    const { data: allOrders, error: ordersError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id, shopify_order_id, order_number")
      .order("created_at", { ascending: true });

    if (ordersError) {
      console.error("Error fetching orders", ordersError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar pedidos", details: ordersError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Buscar todos os pedido_ids que já têm itens
    const { data: allItems } = await supabase
      .from("ebd_shopify_pedidos_itens")
      .select("pedido_id");

    const pedidoIdsComItens = new Set((allItems || []).map(item => item.pedido_id));
    
    // Filtrar pedidos que não têm itens
    const ordersToProcess = (allOrders || [])
      .filter(order => !pedidoIdsComItens.has(order.id))
      .slice(0, batchSize);

    if (!ordersToProcess || ordersToProcess.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Todos os pedidos já possuem itens sincronizados",
          processed: 0,
          total_items: 0 
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Found ${ordersToProcess.length} orders without items`);

    let processedCount = 0;
    let totalItemsSynced = 0;
    const errors: Array<{ order_number: string; error: string }> = [];

    // 2. Para cada pedido, buscar na Shopify e salvar itens
    for (const order of ordersToProcess) {
      try {
        console.log(`Processing order ${order.order_number} (${order.shopify_order_id})`);

        const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders/${order.shopify_order_id}.json?fields=id,name,line_items`;
        
        const resp = await fetch(shopifyUrl, {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error(`Failed to fetch order ${order.order_number}`, resp.status, text);
          errors.push({ order_number: order.order_number, error: `Shopify error: ${resp.status}` });
          continue;
        }

        const payload = (await resp.json()) as { order: ShopifyOrder };
        const shopifyOrder = payload.order;

        if (!shopifyOrder.line_items || shopifyOrder.line_items.length === 0) {
          console.log(`Order ${order.order_number} has no line items`);
          processedCount++;
          continue;
        }

        // Preparar itens para inserção
        const itemRows = shopifyOrder.line_items.map((item) => ({
          pedido_id: order.id,
          shopify_line_item_id: item.id,
          product_title: item.title,
          variant_title: item.variant_title || null,
          sku: item.sku || null,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total_discount: parseFloat(item.total_discount || "0"),
        }));

        const { error: upsertError } = await supabase
          .from("ebd_shopify_pedidos_itens")
          .upsert(itemRows, { onConflict: "pedido_id,shopify_line_item_id", ignoreDuplicates: false });

        if (upsertError) {
          console.error(`Error upserting items for ${order.order_number}`, upsertError);
          errors.push({ order_number: order.order_number, error: upsertError.message });
          continue;
        }

        processedCount++;
        totalItemsSynced += itemRows.length;
        console.log(`Synced ${itemRows.length} items for order ${order.order_number}`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err) {
        console.error(`Error processing order ${order.order_number}`, err);
        errors.push({ 
          order_number: order.order_number, 
          error: err instanceof Error ? err.message : "Unknown error" 
        });
      }
    }

    // 3. Contar quantos pedidos ainda faltam
    const { data: remainingOrders } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id");
    
    const { data: existingItems } = await supabase
      .from("ebd_shopify_pedidos_itens")
      .select("pedido_id");
    
    const completedPedidoIds = new Set((existingItems || []).map(item => item.pedido_id));
    const remainingCount = (remainingOrders || []).filter(order => !completedPedidoIds.has(order.id)).length;

    console.log(`Backfill complete. Processed: ${processedCount}, Items synced: ${totalItemsSynced}, Remaining: ${remainingCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        processed: processedCount,
        total_items_synced: totalItemsSynced,
        remaining_orders: remainingCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Backfill error", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
