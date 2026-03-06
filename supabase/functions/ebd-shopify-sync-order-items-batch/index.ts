import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";
const BATCH_LIMIT = 15; // pedidos por execução
const DELAY_MS = 500; // delay entre chamadas Shopify

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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Usar RPC com LEFT JOIN para encontrar pedidos sem itens (sem limite de 1000 rows)
    const { data: pedidosParaSync, error: fetchError } = await supabase
      .rpc("get_pedidos_sem_itens", { p_limit: BATCH_LIMIT });

    if (fetchError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar pedidos", details: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pedidosParaSync.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Todos os pedidos já têm itens sincronizados!",
        synced: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${pedidosParaSync.length} orders without items`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const failures: { order_id: number; error: string }[] = [];

    for (const pedido of pedidosParaSync) {
      try {
        const shopifyUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders/${pedido.shopify_order_id}.json?fields=id,name,line_items`;

        const resp = await fetch(shopifyUrl, {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        });

        if (!resp.ok) {
          const text = await resp.text();
          console.error(`Failed order ${pedido.shopify_order_id}: ${resp.status}`);
          
          // Se 404, o pedido foi deletado no Shopify - marcar com item placeholder
          if (resp.status === 404) {
            await supabase.from("ebd_shopify_pedidos_itens").upsert({
              pedido_id: pedido.id,
              shopify_line_item_id: 0,
              product_title: "[Pedido removido do Shopify]",
              quantity: 0,
              price: 0,
              total_discount: 0,
            }, { onConflict: "pedido_id,shopify_line_item_id", ignoreDuplicates: false });
            skippedCount++;
          } else {
            failures.push({ order_id: pedido.shopify_order_id, error: `HTTP ${resp.status}: ${text.substring(0, 100)}` });
            failCount++;
          }
          await delay(DELAY_MS);
          continue;
        }

        const payload = (await resp.json()) as { order: ShopifyOrder };
        const order = payload.order;

        if (!order.line_items || order.line_items.length === 0) {
          successCount++;
          await delay(DELAY_MS);
          continue;
        }

        const itemRows = order.line_items.map((item) => ({
          pedido_id: pedido.id,
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
          console.error(`Upsert error for ${pedido.shopify_order_id}:`, upsertError.message);
          failures.push({ order_id: pedido.shopify_order_id, error: upsertError.message });
          failCount++;
        } else {
          successCount++;
        }

        await delay(DELAY_MS);
      } catch (err) {
        console.error(`Error processing ${pedido.shopify_order_id}:`, err);
        failures.push({ order_id: pedido.shopify_order_id, error: String(err) });
        failCount++;
        await delay(DELAY_MS);
      }
    }

    // 3. Verificar quantos ainda faltam
    const { count: totalPagos } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id", { count: "exact", head: true })
      .eq("status_pagamento", "paid")
      .not("shopify_order_id", "is", null);

    const { count: totalComItens } = await supabase
      .from("ebd_shopify_pedidos_itens")
      .select("pedido_id", { count: "exact", head: true });

    return new Response(JSON.stringify({
      success: true,
      batch_processed: pedidosParaSync.length,
      success_count: successCount,
      fail_count: failCount,
      failures: failures.length > 0 ? failures : undefined,
      remaining_estimate: (totalPagos || 0) - (totalComItens || 0),
      total_orders: totalPagos,
      total_with_items: totalComItens,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Batch sync error", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
