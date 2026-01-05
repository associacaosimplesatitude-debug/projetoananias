import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2025-07";

interface ShopifyOrder {
  id: number;
  name: string;
  financial_status: string;
  cancelled_at: string | null;
  closed_at: string | null;
  updated_at: string;
  email: string | null;
  total_price: string;
}

interface OrderToSync {
  id: string;
  shopify_order_id: number;
  order_number: string;
}

interface PropostaToSync {
  id: string;
  cliente_nome: string;
  cliente_id: string | null;
  payment_link: string | null;
  created_at: string;
  valor_total: number;
}

/**
 * Maps Shopify financial_status + cancelled_at to our internal status
 */
function mapShopifyStatus(order: ShopifyOrder): string {
  if (order.cancelled_at) {
    return "expirado";
  }

  const fs = order.financial_status?.toLowerCase() || "";

  switch (fs) {
    case "paid":
      return "paid";
    case "refunded":
    case "voided":
      return "cancelado";
    case "pending":
    case "authorized":
    case "partially_paid":
    case "unpaid":
    default:
      return "pending";
  }
}

/**
 * Extract Shopify Draft Order ID from payment link URL
 * Example: https://www.centralgospel.com.br/61268131974/invoices/063794998e292b67af3261aa4373cebf
 */
function extractDraftOrderToken(paymentLink: string | null): string | null {
  if (!paymentLink) return null;
  const match = paymentLink.match(/invoices\/([a-f0-9]+)/);
  return match ? match[1] : null;
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

    const body = await req.json().catch(() => ({})) as {
      order_ids?: string[];
      shopify_order_ids?: number[];
      vendedor_id?: string;
      sync_all_pending?: boolean;
      sync_propostas?: boolean; // Sync propostas AGUARDANDO_PAGAMENTO
    };

    console.log("[SHOPIFY_SYNC] Request body:", JSON.stringify(body));

    const results: {
      orders_synced: number;
      propostas_synced: number;
      order_updates: Array<{ order_number: string; new_status: string; cancelled_at: string | null }>;
      proposta_updates: Array<{ cliente_nome: string; old_status: string; new_status: string }>;
    } = {
      orders_synced: 0,
      propostas_synced: 0,
      order_updates: [],
      proposta_updates: [],
    };

    // === SYNC SHOPIFY ORDERS ===
    let ordersToSync: OrderToSync[] = [];

    if (body.order_ids && body.order_ids.length > 0) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id, order_number")
        .in("id", body.order_ids);

      if (error) throw error;
      ordersToSync = data || [];
    } else if (body.shopify_order_ids && body.shopify_order_ids.length > 0) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id, order_number")
        .in("shopify_order_id", body.shopify_order_ids);

      if (error) throw error;
      ordersToSync = data || [];
    } else if (body.vendedor_id) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id, order_number")
        .eq("vendedor_id", body.vendedor_id)
        .in("status_pagamento", ["pending", "authorized", "partially_paid"]);

      if (error) throw error;
      ordersToSync = data || [];
    } else if (body.sync_all_pending) {
      const { data, error } = await supabase
        .from("ebd_shopify_pedidos")
        .select("id, shopify_order_id, order_number")
        .in("status_pagamento", ["pending", "authorized", "partially_paid"]);

      if (error) throw error;
      ordersToSync = data || [];
    }

    console.log(`[SHOPIFY_SYNC] totalPedidos=${ordersToSync.length} vendedorId=${body.vendedor_id || 'N/A'}`);

    // Sync each order
    for (const order of ordersToSync) {
      try {
        const url = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders/${order.shopify_order_id}.json?fields=id,name,financial_status,cancelled_at,closed_at,updated_at`;

        const resp = await fetch(url, {
          method: "GET",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        });

        if (!resp.ok) {
          console.error(`[SHOPIFY_SYNC] Failed to fetch order ${order.order_number}: ${resp.status}`);
          continue;
        }

        const payload = await resp.json() as { order: ShopifyOrder };
        const shopifyOrder = payload.order;

        if (!shopifyOrder) continue;

        const newStatus = mapShopifyStatus(shopifyOrder);

        console.log(`[SHOPIFY_SYNC] pedido=${order.order_number} shopify_order_id=${order.shopify_order_id} financial_status=${shopifyOrder.financial_status} cancelled_at=${shopifyOrder.cancelled_at} -> status_sistema=${newStatus}`);

        const { error } = await supabase
          .from("ebd_shopify_pedidos")
          .update({
            status_pagamento: newStatus,
            shopify_cancelled_at: shopifyOrder.cancelled_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (!error) {
          results.orders_synced++;
          results.order_updates.push({
            order_number: order.order_number,
            new_status: newStatus,
            cancelled_at: shopifyOrder.cancelled_at,
          });
        }
      } catch (err) {
        console.error(`[SHOPIFY_SYNC] Error processing order ${order.order_number}:`, err);
      }
    }

    // === SYNC PROPOSTAS AGUARDANDO_PAGAMENTO ===
    if (body.sync_propostas || body.vendedor_id || body.sync_all_pending) {
      let propostasQuery = supabase
        .from("vendedor_propostas")
        .select("id, cliente_nome, cliente_id, payment_link, created_at, valor_total")
        .eq("status", "AGUARDANDO_PAGAMENTO")
        .not("payment_link", "is", null);

      if (body.vendedor_id) {
        propostasQuery = propostasQuery.eq("vendedor_id", body.vendedor_id);
      }

      const { data: propostas, error: propostasError } = await propostasQuery;

      if (propostasError) {
        console.error("[SHOPIFY_SYNC] Error fetching propostas:", propostasError);
      } else if (propostas && propostas.length > 0) {
        console.log(`[SHOPIFY_SYNC] Checking ${propostas.length} propostas AGUARDANDO_PAGAMENTO`);

        for (const proposta of propostas as PropostaToSync[]) {
          try {
            let newPropostaStatus: string | null = null;

            // Method 1: Check if there's a matching paid order in our DB by cliente_id
            if (proposta.cliente_id) {
              const { data: orderByCliente } = await supabase
                .from("ebd_shopify_pedidos")
                .select("id, status_pagamento, shopify_cancelled_at, valor_total")
                .eq("cliente_id", proposta.cliente_id)
                .gte("created_at", proposta.created_at)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (orderByCliente) {
                const orderStatus = orderByCliente.status_pagamento?.toLowerCase();
                if (orderStatus === "paid") {
                  newPropostaStatus = "PAGO";
                } else if (orderByCliente.shopify_cancelled_at || orderStatus === "expirado" || orderStatus === "cancelado") {
                  newPropostaStatus = "EXPIRADO";
                }
              }
            }

            // Method 2: If no matching order found, check Draft Order status directly in Shopify
            if (!newPropostaStatus && proposta.payment_link) {
              // Extract invoice token from payment link
              // Format: https://www.centralgospel.com.br/61268131974/invoices/063794998e292b67af3261aa4373cebf
              const invoiceToken = extractDraftOrderToken(proposta.payment_link);
              
              if (invoiceToken) {
                // Search for draft orders by invoice_url or checkout token
                // Unfortunately Shopify doesn't allow direct lookup by invoice token
                // Instead, we'll search for orders created after this proposta date and match by value
                
                // Try to find a regular order that matches this proposta's value
                const searchUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${proposta.created_at}&fields=id,name,financial_status,cancelled_at,total_price,email`;
                
                const resp = await fetch(searchUrl, {
                  method: "GET",
                  headers: {
                    "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                    "Content-Type": "application/json",
                  },
                });

                if (resp.ok) {
                  const payload = await resp.json() as { orders: ShopifyOrder[] };
                  const orders = payload.orders || [];
                  
                  // Find a matching order by approximate value (within 1 BRL tolerance)
                  const propostaValue = proposta.valor_total;
                  const matchingOrder = orders.find(o => {
                    const orderValue = parseFloat(o.total_price);
                    return Math.abs(orderValue - propostaValue) < 1;
                  });

                  if (matchingOrder) {
                    console.log(`[SHOPIFY_SYNC] Found matching order ${matchingOrder.name} for proposta ${proposta.cliente_nome}`);
                    
                    if (matchingOrder.cancelled_at) {
                      newPropostaStatus = "EXPIRADO";
                    } else if (matchingOrder.financial_status === "paid") {
                      newPropostaStatus = "PAGO";
                    } else if (["voided", "refunded"].includes(matchingOrder.financial_status)) {
                      newPropostaStatus = "EXPIRADO";
                    }
                  }
                }
              }
            }

            // Method 3: Check if proposta is old (> 7 days) - likely expired
            if (!newPropostaStatus) {
              const propostaDate = new Date(proposta.created_at);
              const now = new Date();
              const daysDiff = (now.getTime() - propostaDate.getTime()) / (1000 * 60 * 60 * 24);
              
              // Shopify Draft Order invoices typically expire after 7 days
              if (daysDiff > 7) {
                console.log(`[SHOPIFY_SYNC] proposta=${proposta.cliente_nome} is ${daysDiff.toFixed(1)} days old, marking as EXPIRADO`);
                newPropostaStatus = "EXPIRADO";
              }
            }

            if (newPropostaStatus) {
              console.log(`[SHOPIFY_SYNC] proposta=${proposta.cliente_nome} -> ${newPropostaStatus}`);

              const { error } = await supabase
                .from("vendedor_propostas")
                .update({ status: newPropostaStatus })
                .eq("id", proposta.id);

              if (!error) {
                results.propostas_synced++;
                results.proposta_updates.push({
                  cliente_nome: proposta.cliente_nome,
                  old_status: "AGUARDANDO_PAGAMENTO",
                  new_status: newPropostaStatus,
                });
              }
            }
          } catch (err) {
            console.error(`[SHOPIFY_SYNC] Error processing proposta ${proposta.cliente_nome}:`, err);
          }
        }
      }
    }

    console.log(`[SHOPIFY_SYNC] Complete. Orders: ${results.orders_synced}, Propostas: ${results.propostas_synced}`);

    return new Response(JSON.stringify({ 
      success: true, 
      synced: results.orders_synced,
      propostas_synced: results.propostas_synced,
      total_checked: ordersToSync.length,
      updates: results.order_updates,
      proposta_updates: results.proposta_updates,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SHOPIFY_SYNC] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
