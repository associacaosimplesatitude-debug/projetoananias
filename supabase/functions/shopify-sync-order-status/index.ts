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

interface ShopifyDraftOrder {
  id: number;
  name: string;
  status: string; // "open", "invoice_sent", "completed"
  invoice_sent_at: string | null;
  invoice_url: string | null;
  order_id: number | null;
  completed_at: string | null;
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

            // Method 2: Check Draft Orders directly in Shopify
            // Draft order invoices expire, and we need to check the status
            if (!newPropostaStatus && proposta.payment_link) {
              // Get recent draft orders and check their status
              const draftOrdersUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json?status=open&limit=50`;
              
              const draftResp = await fetch(draftOrdersUrl, {
                method: "GET",
                headers: {
                  "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                  "Content-Type": "application/json",
                },
              });

              if (draftResp.ok) {
                const draftPayload = await draftResp.json() as { draft_orders: ShopifyDraftOrder[] };
                const draftOrders = draftPayload.draft_orders || [];
                
                console.log(`[SHOPIFY_SYNC] Fetched ${draftOrders.length} draft orders from Shopify`);
                
                // Find matching draft order by value and invoice_url
                const propostaValue = proposta.valor_total;
                const matchingDraft = draftOrders.find(d => {
                  const draftValue = parseFloat(d.total_price);
                  const valueMatches = Math.abs(draftValue - propostaValue) < 1;
                  // Also check if invoice_url contains the same token
                  const invoiceToken = extractDraftOrderToken(proposta.payment_link);
                  const draftToken = d.invoice_url ? extractDraftOrderToken(d.invoice_url) : null;
                  return valueMatches || (invoiceToken && draftToken && invoiceToken === draftToken);
                });

                if (matchingDraft) {
                  console.log(`[SHOPIFY_SYNC] Found matching draft order ${matchingDraft.name} for proposta ${proposta.cliente_nome} - status=${matchingDraft.status} order_id=${matchingDraft.order_id}`);
                  
                  if (matchingDraft.status === "completed" && matchingDraft.order_id) {
                    // Draft was completed - check the actual order status
                    const orderUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders/${matchingDraft.order_id}.json?fields=id,name,financial_status,cancelled_at`;
                    const orderResp = await fetch(orderUrl, {
                      method: "GET",
                      headers: {
                        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
                        "Content-Type": "application/json",
                      },
                    });
                    
                    if (orderResp.ok) {
                      const orderPayload = await orderResp.json() as { order: ShopifyOrder };
                      const order = orderPayload.order;
                      
                      console.log(`[SHOPIFY_SYNC] Order ${order.name} from draft - financial_status=${order.financial_status} cancelled_at=${order.cancelled_at}`);
                      
                      if (order.financial_status === "paid") {
                        newPropostaStatus = "PAGO";
                      } else if (order.cancelled_at || ["voided", "refunded"].includes(order.financial_status?.toLowerCase() || "")) {
                        newPropostaStatus = "EXPIRADO";
                      }
                    }
                  }
                }
              }
              
              // Also search for completed orders created from draft orders
              if (!newPropostaStatus) {
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
                  
                  console.log(`[SHOPIFY_SYNC] Fetched ${orders.length} orders from Shopify for proposta ${proposta.cliente_nome}`);
                  
                  // Find a matching order by approximate value
                  const propostaValue = proposta.valor_total;
                  const matchingOrder = orders.find(o => {
                    const orderValue = parseFloat(o.total_price);
                    return Math.abs(orderValue - propostaValue) < 1;
                  });

                  if (matchingOrder) {
                    console.log(`[SHOPIFY_SYNC] Found matching order ${matchingOrder.name} for proposta ${proposta.cliente_nome} - financial_status=${matchingOrder.financial_status} cancelled_at=${matchingOrder.cancelled_at}`);
                    
                    // If order has pending status for more than a few hours and has no payment, it's likely expired
                    // Shopify draft order invoices expire after a configurable period (default 24 hours)
                    if (matchingOrder.cancelled_at) {
                      console.log(`[SHOPIFY_SYNC] Order ${matchingOrder.name} is CANCELLED -> marking proposta as EXPIRADO`);
                      newPropostaStatus = "EXPIRADO";
                    } else if (matchingOrder.financial_status === "paid") {
                      newPropostaStatus = "PAGO";
                    } else if (["voided", "refunded"].includes(matchingOrder.financial_status?.toLowerCase() || "")) {
                      console.log(`[SHOPIFY_SYNC] Order ${matchingOrder.name} financial_status=${matchingOrder.financial_status} -> marking proposta as EXPIRADO`);
                      newPropostaStatus = "EXPIRADO";
                    } else if (matchingOrder.financial_status === "pending") {
                      // Check if the order is old enough to consider expired
                      // Shopify draft order invoices typically expire after a few hours (configurable, default often 24h but many stores use shorter)
                      // If there's a matching order with pending status, it means invoice was generated but not paid
                      // We'll mark as expired if it's been more than 3 hours with no payment
                      const propostaDate = new Date(proposta.created_at);
                      const now = new Date();
                      const hoursDiff = (now.getTime() - propostaDate.getTime()) / (1000 * 60 * 60);
                      
                      if (hoursDiff > 3) {
                        console.log(`[SHOPIFY_SYNC] Order ${matchingOrder.name} is pending for ${hoursDiff.toFixed(1)}h -> marking as EXPIRADO (invoice likely expired)`);
                        newPropostaStatus = "EXPIRADO";
                      } else {
                        console.log(`[SHOPIFY_SYNC] Order ${matchingOrder.name} is pending for ${hoursDiff.toFixed(1)}h, keeping as AGUARDANDO`);
                      }
                    }
                  }
                }
              }
            }

            // Method 3: Check if proposta is old (> 3 hours with no matching order) - likely expired
            if (!newPropostaStatus) {
              const propostaDate = new Date(proposta.created_at);
              const now = new Date();
              const hoursDiff = (now.getTime() - propostaDate.getTime()) / (1000 * 60 * 60);
              
              // Shopify Draft Order invoices typically expire after a few hours
              // Mark as expired if > 3 hours old with no payment confirmation
              if (hoursDiff > 3) {
                console.log(`[SHOPIFY_SYNC] proposta=${proposta.cliente_nome} is ${hoursDiff.toFixed(1)} hours old with no payment, marking as EXPIRADO`);
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
