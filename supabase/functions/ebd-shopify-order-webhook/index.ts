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

    // If payment is confirmed (paid), update related vendedor_propostas status to PAGO
    if (statusPagamento === "paid") {
      console.log("Payment confirmed, checking for related proposal...");
      
      let matchingPropostaId: string | null = null;
      
      // Method 1: Try to find proposal by cliente_id
      if (clienteId) {
        const { data: propostas, error: propostaError } = await supabase
          .from("vendedor_propostas")
          .select("id, valor_total")
          .eq("cliente_id", clienteId)
          .eq("status", "AGUARDANDO_PAGAMENTO");
        
        if (propostaError) {
          console.error("Error fetching propostas by cliente_id:", propostaError);
        } else if (propostas && propostas.length > 0) {
          const matchingProposta = propostas.find(p => {
            const diff = Math.abs(p.valor_total - valorTotal);
            return diff < 1;
          });
          if (matchingProposta) {
            matchingPropostaId = matchingProposta.id;
            console.log("Found matching proposal by cliente_id:", matchingPropostaId);
          }
        }
      }
      
      // Method 2: If not found by cliente_id, try to find by customer email and value
      if (!matchingPropostaId && (order.email || order.customer?.email)) {
        const customerEmail = order.email || order.customer?.email;
        console.log("Trying to find proposal by email:", customerEmail);
        
        // First find the cliente by email
        const { data: clientes, error: clienteError } = await supabase
          .from("ebd_clientes")
          .select("id")
          .eq("email_superintendente", customerEmail);
        
        if (clienteError) {
          console.error("Error fetching cliente by email:", clienteError);
        } else if (clientes && clientes.length > 0) {
          const clienteIds = clientes.map(c => c.id);
          
          const { data: propostas, error: propostaError } = await supabase
            .from("vendedor_propostas")
            .select("id, valor_total, cliente_id")
            .in("cliente_id", clienteIds)
            .eq("status", "AGUARDANDO_PAGAMENTO");
          
          if (propostaError) {
            console.error("Error fetching propostas by email:", propostaError);
          } else if (propostas && propostas.length > 0) {
            const matchingProposta = propostas.find(p => {
              const diff = Math.abs(p.valor_total - valorTotal);
              return diff < 1;
            });
            if (matchingProposta) {
              matchingPropostaId = matchingProposta.id;
              console.log("Found matching proposal by email:", matchingPropostaId);
              
              // Also update the ebd_shopify_pedidos record with the cliente_id
              if (matchingProposta.cliente_id) {
                await supabase
                  .from("ebd_shopify_pedidos")
                  .update({ cliente_id: matchingProposta.cliente_id })
                  .eq("shopify_order_id", order.id);
              }
            }
          }
        }
      }
      
      // Method 3: Try to find by customer name and value
      if (!matchingPropostaId && order.customer) {
        const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim();
        console.log("Trying to find proposal by customer name:", customerName);
        
        const { data: propostas, error: propostaError } = await supabase
          .from("vendedor_propostas")
          .select("id, valor_total, cliente_id, cliente_nome")
          .eq("status", "AGUARDANDO_PAGAMENTO");
        
        if (propostaError) {
          console.error("Error fetching propostas for name matching:", propostaError);
        } else if (propostas && propostas.length > 0) {
          // Find proposal that matches both name and value
          const matchingProposta = propostas.find(p => {
            const diff = Math.abs(p.valor_total - valorTotal);
            const nameMatch = p.cliente_nome?.toLowerCase().includes(customerName.toLowerCase()) ||
                              customerName.toLowerCase().includes(p.cliente_nome?.toLowerCase() || '');
            return diff < 1 && nameMatch;
          });
          if (matchingProposta) {
            matchingPropostaId = matchingProposta.id;
            console.log("Found matching proposal by name:", matchingPropostaId);
            
            // Also update the ebd_shopify_pedidos record with the cliente_id
            if (matchingProposta.cliente_id) {
              await supabase
                .from("ebd_shopify_pedidos")
                .update({ cliente_id: matchingProposta.cliente_id })
                .eq("shopify_order_id", order.id);
            }
          }
        }
      }
      
      // Update the matching proposal to PAGO
      if (matchingPropostaId) {
        const { error: updateError } = await supabase
          .from("vendedor_propostas")
          .update({ status: "PAGO" })
          .eq("id", matchingPropostaId);
        
        if (updateError) {
          console.error("Error updating proposal status:", updateError);
        } else {
          console.log("Proposal status updated to PAGO:", matchingPropostaId);
        }
      } else {
        console.log("No matching proposal found for order:", order.id, "value:", valorTotal);
      }

      // AUTO-UPDATE LANDING PAGE LEADS
      // If a lead from landing page made a purchase, automatically move to "Fechou"
      const customerEmail = order.email || order.customer?.email;
      if (customerEmail) {
        console.log("=== LEAD KANBAN UPDATE START ===");
        console.log("Looking for landing page lead with email:", customerEmail);
        
        // First try: Find lead by direct email match
        let leadData = null;
        
        const { data: directLead, error: directError } = await supabase
          .from("ebd_leads_reativacao")
          .select("id, status_kanban, vendedor_id, email, nome_igreja")
          .eq("email", customerEmail)
          .eq("created_via", "landing_page_form")
          .neq("status_kanban", "Fechou")
          .neq("status_kanban", "Cancelado")
          .maybeSingle();
        
        if (directError) {
          console.error("Error fetching lead by direct email:", directError);
        } else if (directLead) {
          leadData = directLead;
          console.log("Found lead by direct email match:", leadData.id, leadData.nome_igreja);
        }
        
        // Second try: If not found, look via ebd_clientes table
        if (!leadData) {
          console.log("No direct match, trying via ebd_clientes...");
          
          const { data: clienteData, error: clienteError } = await supabase
            .from("ebd_clientes")
            .select("id, email_superintendente, nome_igreja")
            .eq("email_superintendente", customerEmail)
            .maybeSingle();
          
          if (clienteError) {
            console.error("Error fetching cliente:", clienteError);
          } else if (clienteData) {
            console.log("Found cliente:", clienteData.id, clienteData.nome_igreja);
            
            // Now find the lead by cliente's email
            const { data: clienteLead, error: leadByClienteError } = await supabase
              .from("ebd_leads_reativacao")
              .select("id, status_kanban, vendedor_id, email, nome_igreja")
              .eq("email", clienteData.email_superintendente)
              .eq("created_via", "landing_page_form")
              .neq("status_kanban", "Fechou")
              .neq("status_kanban", "Cancelado")
              .maybeSingle();
            
            if (leadByClienteError) {
              console.error("Error fetching lead by cliente email:", leadByClienteError);
            } else if (clienteLead) {
              leadData = clienteLead;
              console.log("Found lead via cliente:", leadData.id, leadData.nome_igreja);
            }
          }
        }
        
        if (leadData) {
          console.log("Updating lead to Fechou:", {
            leadId: leadData.id,
            currentStatus: leadData.status_kanban,
            valorTotal,
            hasVendedor: !!leadData.vendedor_id
          });
          
          // Update lead to "Fechou" status with purchase value
          const { error: updateLeadError } = await supabase
            .from("ebd_leads_reativacao")
            .update({
              status_kanban: "Fechou",
              status_lead: "Convertido",
              valor_fechamento: valorTotal,
              data_fechamento: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", leadData.id);
          
          if (updateLeadError) {
            console.error("Error updating landing page lead status:", updateLeadError);
          } else {
            console.log("✅ Lead automatically closed:", leadData.id, "value:", valorTotal);
            
            // If lead has vendedor assigned, log for commission tracking
            if (leadData.vendedor_id) {
              console.log("Lead had vendedor assigned:", leadData.vendedor_id, "- commission applies");
            } else {
              console.log("Lead closed directly without vendedor - direct sale");
            }
          }
        } else {
          console.log("No pending landing page lead found for email:", customerEmail);
          console.log("This might be a regular purchase, not from landing page form");
        }
        console.log("=== LEAD KANBAN UPDATE END ===");
      }
    }

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
