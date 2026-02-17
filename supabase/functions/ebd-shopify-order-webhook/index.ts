import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-topic, x-shopify-shop-domain",
};

interface ShopifyAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  province_code?: string;
  zip?: string;
  country?: string;
  country_code?: string;
  phone?: string;
}

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
    phone?: string;
  } | null;
  shipping_address?: ShopifyAddress;
  billing_address?: ShopifyAddress;
  line_items?: Array<{
    title: string;
    quantity: number;
    price: string;
    variant_title?: string;
  }>;
  created_at: string;
  updated_at: string;
}

// Function to fetch fulfillment data from Shopify
async function fetchFulfillmentData(orderId: number): Promise<{ trackingNumber: string | null; trackingUrl: string | null }> {
  const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
  const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
  
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

// Generate a random temporary password
function generateTempPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    password += chars[byte % chars.length];
  }
  return password;
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

    // Extract vendedor_id, cliente_id, and cpf_cnpj from note_attributes
    let vendedorId: string | null = null;
    let clienteId: string | null = null;
    let cpfCnpj: string | null = null;

    if (order.note_attributes && Array.isArray(order.note_attributes)) {
      for (const attr of order.note_attributes) {
        if (attr.name === "vendedor_id") {
          vendedorId = attr.value;
        }
        if (attr.name === "cliente_id") {
          clienteId = attr.value;
        }
        if (attr.name === "cpf_cnpj") {
          cpfCnpj = attr.value;
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

    console.log("Extracted IDs:", { vendedorId, clienteId, cpfCnpj });

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

    // Extract shipping address data
    const shippingAddr = order.shipping_address || order.billing_address;
    const parseAddress = (addr: ShopifyAddress | undefined) => {
      if (!addr) return {};
      // address2 might contain "numero - bairro" pattern from our order creation
      const address2 = addr.address2 || '';
      const parts = address2.split(' - ');
      const numero = parts[0]?.trim() || '';
      const bairro = parts.slice(1).join(' - ')?.trim() || '';
      
      return {
        endereco_rua: addr.address1 || null,
        endereco_numero: numero || null,
        endereco_complemento: addr.company || null,
        endereco_bairro: bairro || null,
        endereco_cidade: addr.city || null,
        endereco_estado: addr.province_code || addr.province || null,
        endereco_cep: addr.zip || null,
      };
    };
    
    const addressData = parseAddress(shippingAddr);

    // Extract phone from order
    const customerPhone = order.customer?.phone || shippingAddr?.phone || null;
    const customerEmail = order.email || order.customer?.email;

    // ===================================================================
    // GARANTIA DE ATRIBUIÇÃO DE VENDEDOR
    // Prioridade:
    // 1. Se o pedido já existe no banco com vendedor_id, mantemos o existente
    // 2. Se veio vendedor_id nos note_attributes, usamos esse
    // 3. Se não tem vendedor, buscamos do cliente cadastrado (HERANÇA AUTOMÁTICA)
    // ===================================================================
    let finalVendedorId = vendedorId;
    
    // Verificar se o pedido já existe no banco e tem vendedor_id
    const { data: existingOrder, error: fetchError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("vendedor_id, cliente_id")
      .eq("shopify_order_id", order.id)
      .maybeSingle();
    
    if (fetchError) {
      console.error("Error fetching existing order:", fetchError);
    } else if (existingOrder) {
      console.log("Pedido existente encontrado:", {
        shopify_order_id: order.id,
        vendedor_id_existente: existingOrder.vendedor_id,
        cliente_id_existente: existingOrder.cliente_id
      });
      
      // Se já tem vendedor_id no banco, mantém o existente
      if (existingOrder.vendedor_id) {
        finalVendedorId = existingOrder.vendedor_id;
        console.log("Mantendo vendedor_id existente:", finalVendedorId);
      }
      
      // Se já tem cliente_id no banco e não veio nos note_attributes, mantém o existente
      if (!clienteId && existingOrder.cliente_id) {
        clienteId = existingOrder.cliente_id;
        console.log("Mantendo cliente_id existente:", clienteId);
      }
    }

    // ===================================================================
    // HERANÇA AUTOMÁTICA DE VENDEDOR DO CLIENTE CADASTRADO
    // Se o pedido ainda não tem vendedor_id, buscar do cliente cadastrado
    // ===================================================================
    if (!finalVendedorId) {
      console.log("=== HERANÇA DE VENDEDOR ===");
      console.log("Pedido sem vendedor, buscando vendedor do cliente cadastrado...");
      
      console.log("Email do cliente:", customerEmail);
      console.log("CPF/CNPJ do pedido:", cpfCnpj);
      
      // Método 1: Buscar cliente por email
      if (customerEmail) {
        const { data: clienteByEmail, error: emailError } = await supabase
          .from("ebd_clientes")
          .select("id, vendedor_id, nome_igreja")
          .eq("email_superintendente", customerEmail)
          .not("vendedor_id", "is", null)
          .maybeSingle();
        
        if (emailError) {
          console.error("Error fetching cliente by email:", emailError);
        } else if (clienteByEmail?.vendedor_id) {
          finalVendedorId = clienteByEmail.vendedor_id;
          if (!clienteId) clienteId = clienteByEmail.id;
          console.log("✅ Vendedor herdado do cliente por EMAIL:", {
            cliente: clienteByEmail.nome_igreja,
            vendedor_id: finalVendedorId
          });
        }
      }
      
      // Método 2: Buscar cliente por CPF/CNPJ (se não encontrou por email)
      if (!finalVendedorId && cpfCnpj) {
        const cleanDoc = cpfCnpj.replace(/\D/g, '');
        console.log("Buscando por CPF/CNPJ:", cleanDoc);
        
        const { data: clienteByDoc, error: docError } = await supabase
          .from("ebd_clientes")
          .select("id, vendedor_id, nome_igreja")
          .or(`cnpj.eq.${cleanDoc},cpf.eq.${cleanDoc},cnpj.eq.${cpfCnpj},cpf.eq.${cpfCnpj}`)
          .not("vendedor_id", "is", null)
          .maybeSingle();
        
        if (docError) {
          console.error("Error fetching cliente by CPF/CNPJ:", docError);
        } else if (clienteByDoc?.vendedor_id) {
          finalVendedorId = clienteByDoc.vendedor_id;
          if (!clienteId) clienteId = clienteByDoc.id;
          console.log("✅ Vendedor herdado do cliente por CPF/CNPJ:", {
            cliente: clienteByDoc.nome_igreja,
            vendedor_id: finalVendedorId
          });
        }
      }
      
      // Método 3: Buscar cliente por nome (fuzzy match)
      if (!finalVendedorId && order.customer) {
        const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim().toLowerCase();
        console.log("Buscando por nome do cliente:", customerName);
        
        const { data: clientes, error: nameError } = await supabase
          .from("ebd_clientes")
          .select("id, vendedor_id, nome_igreja, nome_superintendente")
          .not("vendedor_id", "is", null);
        
        if (nameError) {
          console.error("Error fetching clientes for name matching:", nameError);
        } else if (clientes && clientes.length > 0) {
          const matchingCliente = clientes.find(c => {
            const nomeIgreja = c.nome_igreja?.toLowerCase()?.trim();
            const nomeSuperintendente = c.nome_superintendente?.toLowerCase()?.trim();
            
            return (
              (nomeIgreja && nomeIgreja.length > 2 && (
                nomeIgreja.includes(customerName) || customerName.includes(nomeIgreja)
              )) ||
              (nomeSuperintendente && nomeSuperintendente.length > 2 && (
                nomeSuperintendente.includes(customerName) || customerName.includes(nomeSuperintendente)
              ))
            );
          });
          
          if (matchingCliente?.vendedor_id) {
            finalVendedorId = matchingCliente.vendedor_id;
            if (!clienteId) clienteId = matchingCliente.id;
            console.log("✅ Vendedor herdado do cliente por NOME:", {
              cliente: matchingCliente.nome_igreja,
              vendedor_id: finalVendedorId
            });
          }
        }
      }
      
      if (!finalVendedorId) {
        console.log("❌ Nenhum vendedor encontrado para herança automática");
      }
      
      console.log("=== FIM HERANÇA DE VENDEDOR ===");
    }

    console.log("Webhook processado: Pedido", order.name, "atribuído ao Vendedor:", finalVendedorId);

    // === CRIAR ebd_clientes PARA CLIENTES NOVOS ===
    if (!clienteId && statusPagamento === 'paid' && customerEmail) {
      console.log("🆕 Cliente novo detectado - criando ebd_clientes para:", customerEmail);
      const customerNameForInsert = order.customer
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
        : null;
      const customerPhoneForInsert = order.customer?.phone 
        || order.shipping_address?.phone 
        || order.billing_address?.phone 
        || null;

      const { data: newCliente, error: newClienteErr } = await supabase
        .from("ebd_clientes")
        .insert({
          nome_igreja: customerNameForInsert || customerEmail,
          nome_responsavel: customerNameForInsert,
          email_superintendente: customerEmail,
          telefone: customerPhoneForInsert,
          vendedor_id: finalVendedorId,
          is_pos_venda_ecommerce: true,
        })
        .select("id")
        .single();

      if (newClienteErr) {
        console.error("❌ Erro ao criar novo ebd_clientes:", newClienteErr);
      } else {
        clienteId = newCliente.id;
        console.log("✅ Novo ebd_clientes criado com ID:", clienteId);
      }
    }

    // Upsert the order in our database
    const orderData = {
      shopify_order_id: order.id,
      order_number: order.name,
      vendedor_id: finalVendedorId,
      cliente_id: clienteId,
      status_pagamento: statusPagamento,
      valor_total: valorTotal,
      valor_frete: valorFrete,
      valor_para_meta: valorParaMeta,
      customer_email: order.email || order.customer?.email || null,
      customer_name: order.customer 
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim() 
        : null,
      customer_document: cpfCnpj,
      customer_phone: customerPhone,
      ...addressData,
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

    console.log("Webhook processado: Pedido #", order.name, "atribuído ao Vendedor:", finalVendedorId);
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

      // ===================================================================
      // AUTO-PROVISIONING: Criar usuário + funil pós-venda para pedidos pagos
      // ===================================================================
      if (customerEmail && clienteId) {
        console.log("=== AUTO PROVISIONING START ===");
        
        // Verificar se o cliente já tem superintendente_user_id (evitar recriar)
        const { data: clienteCheck } = await supabase
          .from("ebd_clientes")
          .select("id, superintendente_user_id, telefone, nome_responsavel, nome_igreja, email_superintendente, senha_temporaria")
          .eq("id", clienteId)
          .maybeSingle();
        
        if (clienteCheck && !clienteCheck.superintendente_user_id) {
          console.log("Cliente sem usuário, provisionando automaticamente:", clienteId);
          
          // a) Gerar senha temporária
          const tempPassword = "mudar123";
          console.log("Senha temporária gerada para:", customerEmail);
          
          // b) Criar usuário Auth via REST API Admin
          let newUserId: string | null = null;
          const customerName = order.customer
            ? `${order.customer.first_name} ${order.customer.last_name}`.trim()
            : "Superintendente";
          
          try {
            const authResponse = await fetch(
              `${SUPABASE_URL}/auth/v1/admin/users`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                  "apikey": SUPABASE_SERVICE_ROLE_KEY,
                },
                body: JSON.stringify({
                  email: customerEmail,
                  password: tempPassword,
                  email_confirm: true,
                  user_metadata: { full_name: customerName },
                }),
              }
            );
            
            const authData = await authResponse.json();
            
            if (authResponse.ok && authData?.id) {
              newUserId = authData.id;
              console.log("✅ Usuário Auth criado:", newUserId);
            } else if (authData?.msg?.includes("already been registered") || authData?.message?.includes("already been registered")) {
              // Usuário já existe, buscar ID e atualizar senha
              console.log("Usuário já existe, buscando e atualizando senha...");
              const lookupResp = await fetch(
                `${SUPABASE_URL}/auth/v1/admin/users?filter=${encodeURIComponent(customerEmail)}`,
                {
                  headers: {
                    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                  },
                }
              );
              const lookupData = await lookupResp.json();
              const existingUser = lookupData?.users?.find((u: { email: string }) => u.email === customerEmail);
              
              if (existingUser?.id) {
                newUserId = existingUser.id;
                // Atualizar senha
                await fetch(
                  `${SUPABASE_URL}/auth/v1/admin/users/${existingUser.id}`,
                  {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                      "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    },
                    body: JSON.stringify({ password: tempPassword }),
                  }
                );
                console.log("✅ Senha atualizada para usuário existente:", newUserId);
              }
            } else {
              console.error("❌ Erro ao criar usuário Auth:", authData);
            }
          } catch (authErr) {
            console.error("❌ Exceção ao criar usuário Auth:", authErr);
          }
          
          // c) Atualizar ebd_clientes com credenciais
          if (newUserId) {
            const { error: updateClienteErr } = await supabase
              .from("ebd_clientes")
              .update({
                superintendente_user_id: newUserId,
                email_superintendente: customerEmail,
                senha_temporaria: tempPassword,
                status_ativacao_ebd: true,
                is_pos_venda_ecommerce: true,
              })
              .eq("id", clienteId);
            
            if (updateClienteErr) {
              console.error("Erro ao atualizar ebd_clientes:", updateClienteErr);
            } else {
              console.log("✅ ebd_clientes atualizado com credenciais");
            }
            
            // d) Inserir no funil_posv_tracking
            const { error: funilErr } = await supabase
              .from("funil_posv_tracking")
              .upsert(
                { cliente_id: clienteId, fase_atual: 1 },
                { onConflict: "cliente_id", ignoreDuplicates: true }
              );
            
            if (funilErr) {
              console.error("Erro ao inserir funil_posv_tracking:", funilErr);
            } else {
              console.log("✅ funil_posv_tracking inserido (fase 1)");
            }
            
            // e) Enviar WhatsApp Fase 1 imediatamente
            const telefoneCliente = clienteCheck.telefone || order.customer?.phone || (order.shipping_address?.phone) || null;
            
            if (telefoneCliente) {
              console.log("Enviando WhatsApp Fase 1 para:", telefoneCliente);
              
              // Buscar credenciais Z-API + flag de envio automático
              const { data: zapiSettings } = await supabase
                .from("system_settings")
                .select("key, value")
                .in("key", ["zapi_instance_id", "zapi_token", "zapi_client_token", "whatsapp_auto_envio_ativo"]);
              
              const zapiMap: Record<string, string> = {};
              (zapiSettings || []).forEach((s: { key: string; value: string }) => {
                zapiMap[s.key] = s.value;
              });
              
              const instanceId = zapiMap["zapi_instance_id"];
              const zapiToken = zapiMap["zapi_token"];
              const clientToken = zapiMap["zapi_client_token"];
              
              if (instanceId && zapiToken && clientToken && zapiMap["whatsapp_auto_envio_ativo"] !== "false") {
                const nomeCliente = clienteCheck.nome_responsavel || clienteCheck.nome_igreja || customerName;
                const PANEL_URL = "https://gestaoebd.com.br/login/ebd";
                
                // Montar detalhes do pedido
                const lineItems = order.line_items || [];
                let produtosTexto = "";
                if (lineItems.length > 0) {
                  produtosTexto = lineItems.map((item) => {
                    const qty = item.quantity > 1 ? ` x${item.quantity}` : "";
                    return `• ${item.title}${qty} - R$ ${parseFloat(item.price).toFixed(2).replace(".", ",")}`;
                  }).join("\n");
                }
                
                const frete = order.shipping_lines?.reduce((sum, s) => sum + parseFloat(s.price || "0"), 0) || 0;
                const totalPedido = parseFloat(order.total_price || "0");
                const desconto = parseFloat(order.total_discounts || "0");
                
                let detalhesCompra = `📦 Pedido #${order.order_number}\n`;
                if (produtosTexto) detalhesCompra += `\n${produtosTexto}\n`;
                if (frete > 0) detalhesCompra += `\n🚚 Frete: R$ ${frete.toFixed(2).replace(".", ",")}`;
                if (desconto > 0) detalhesCompra += `\n🏷️ Desconto: -R$ ${desconto.toFixed(2).replace(".", ",")}`;
                detalhesCompra += `\n💰 Total: R$ ${totalPedido.toFixed(2).replace(".", ",")}`;
                
                const fase1Msg = `Olá ${nomeCliente}! Obrigado por sua compra na Central Gospel! 🎉\n\n${detalhesCompra}\n\nSeu pedido está sendo preparado! Acesse o painel para acompanhar a entrega, ver prazo e código de rastreio.\n\nSeus dados de acesso:\n📧 Email: ${customerEmail}\n🔑 Senha: ${tempPassword}`;
                
                const zapiBaseUrl = `https://api.z-api.io/instances/${instanceId}/token/${zapiToken}`;
                const zapiPayload = {
                  phone: telefoneCliente,
                  message: fase1Msg,
                  title: "Central Gospel - Pedido Confirmado",
                  footer: "gestaoebd.com.br",
                  buttonActions: [
                    {
                      id: "1",
                      type: "URL",
                      url: PANEL_URL,
                      label: "Acompanhar Pedido"
                    }
                  ]
                };
                
                try {
                  const zapiResp = await fetch(`${zapiBaseUrl}/send-button-actions`, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Client-Token": clientToken,
                    },
                    body: JSON.stringify(zapiPayload),
                  });
                  
                  const zapiResult = await zapiResp.json();
                  const whatsappOk = zapiResp.ok;
                  
                  // Registrar mensagem
                  await supabase.from("whatsapp_mensagens").insert({
                    tipo_mensagem: "funil_fase1_auto",
                    telefone_destino: telefoneCliente,
                    nome_destino: nomeCliente,
                    mensagem: fase1Msg,
                    status: whatsappOk ? "enviado" : "erro",
                    erro_detalhes: whatsappOk ? null : JSON.stringify(zapiResult),
                    payload_enviado: zapiPayload,
                    resposta_recebida: zapiResult,
                  });
                  
                  // Atualizar tracking com fase1_enviada_em
                  if (whatsappOk) {
                    const nowISO = new Date().toISOString();
                    await supabase
                      .from("funil_posv_tracking")
                      .update({
                        fase1_enviada_em: nowISO,
                        ultima_mensagem_em: nowISO,
                      })
                      .eq("cliente_id", clienteId);
                    
                    console.log("✅ WhatsApp Fase 1 enviado e tracking atualizado");
                  } else {
                    console.error("❌ Falha ao enviar WhatsApp Fase 1:", zapiResult);
                  }
                } catch (whatsappErr) {
                  console.error("❌ Exceção ao enviar WhatsApp:", whatsappErr);
                }
              } else {
                console.log("⚠️ Credenciais Z-API não configuradas, WhatsApp não enviado");
              }
            } else {
              console.log("⚠️ Cliente sem telefone, WhatsApp não enviado");
            }
          }
        } else if (clienteCheck?.superintendente_user_id) {
          console.log("Cliente já possui usuário, pulando auto-provisioning:", clienteCheck.superintendente_user_id);
        }
        
        console.log("=== AUTO PROVISIONING END ===");
      }

      // AUTO-UPDATE LANDING PAGE LEADS
      // If a lead from landing page made a purchase, automatically move to "Fechou"
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
