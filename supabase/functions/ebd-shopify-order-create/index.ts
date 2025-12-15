import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOPIFY_STORE = "revendacentralgospel.myshopify.com";
const SHOPIFY_API_VERSION = "2025-01";

interface Cliente {
  id: string;
  nome_igreja: string;
  cnpj: string;
  email_superintendente: string | null;
  telefone: string | null;
  nome_responsavel: string | null;
  endereco_cep: string | null;
  endereco_rua: string | null;
  endereco_numero: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_estado: string | null;
  vendedor_id?: string | null;
}

interface CartItem {
  variantId: string;
  quantity: number;
  title: string;
  price: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
    
    if (!SHOPIFY_ACCESS_TOKEN) {
      console.error("SHOPIFY_ADMIN_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Shopify not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get vendedor_id from request body or from authenticated user
    const { 
      cliente, 
      items, 
      vendedor_id,
      vendedor_nome,      // Vendor name for Bling
      faturamento_prazo,  // "30", "60", or "90" for B2B invoicing
      forma_pagamento,    // "FATURAMENTO" for B2B invoicing
      desconto_percentual, // Discount percentage for B2B clients
      valor_frete,        // Shipping cost
      metodo_frete,       // PAC, SEDEX, or FREE
    } = await req.json() as { 
      cliente: Cliente; 
      items: CartItem[];
      vendedor_id?: string;
      vendedor_nome?: string;
      faturamento_prazo?: string;
      forma_pagamento?: string;
      desconto_percentual?: string;
      valor_frete?: string;
      metodo_frete?: string;
    };

    if (!cliente || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Cliente e itens são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use vendedor_id from request or from cliente
    const finalVendedorId = vendedor_id || cliente.vendedor_id;
    const isFaturamento = forma_pagamento === 'FATURAMENTO' && faturamento_prazo;
    
    // Parse discount and shipping info
    const descontoPercentual = desconto_percentual ? parseFloat(desconto_percentual) : 0;
    const valorFreteRecebido = valor_frete ? parseFloat(valor_frete) : 0;
    const metodoFreteRecebido = metodo_frete || null;
    
    console.log("Creating draft order for cliente:", cliente.nome_igreja);
    console.log("Vendedor ID:", finalVendedorId);
    console.log("Vendedor Nome:", vendedor_nome);
    console.log("Items:", items);
    console.log("Faturamento:", isFaturamento, "Prazo:", faturamento_prazo);
    console.log("Desconto:", descontoPercentual, "%");
    console.log("Frete:", metodoFreteRecebido, "Valor:", valorFreteRecebido);

    // Step 1: Search for existing customer or create new one
    const customerEmail = cliente.email_superintendente || `${cliente.cnpj.replace(/\D/g, '')}@placeholder.com`;
    
    // Search for customer by email
    const searchResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers/search.json?query=email:${encodeURIComponent(customerEmail)}`,
      {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    let customerId: number | null = null;

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.customers && searchData.customers.length > 0) {
        customerId = searchData.customers[0].id;
        console.log("Found existing customer:", customerId);

        // Update customer with latest info
        await fetch(
          `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers/${customerId}.json`,
          {
            method: "PUT",
            headers: {
              "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              customer: {
                first_name: cliente.nome_responsavel || cliente.nome_igreja,
                last_name: "",
                phone: cliente.telefone,
                tags: "ebd_cliente",
                addresses: cliente.endereco_rua ? [{
                  address1: `${cliente.endereco_rua}, ${cliente.endereco_numero || 'S/N'}`,
                  city: cliente.endereco_cidade || "",
                  province: cliente.endereco_estado || "",
                  zip: cliente.endereco_cep || "",
                  country: "BR",
                  company: cliente.nome_igreja,
                }] : undefined,
              },
            }),
          }
        );
      }
    }

    // Create customer if not found
    if (!customerId) {
      console.log("Creating new customer...");
      const createCustomerResponse = await fetch(
        `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/customers.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            customer: {
              email: customerEmail,
              first_name: cliente.nome_responsavel || cliente.nome_igreja,
              last_name: "",
              phone: cliente.telefone,
              tags: "ebd_cliente",
              addresses: cliente.endereco_rua ? [{
                address1: `${cliente.endereco_rua}, ${cliente.endereco_numero || 'S/N'}`,
                city: cliente.endereco_cidade || "",
                province: cliente.endereco_estado || "",
                zip: cliente.endereco_cep || "",
                country: "BR",
                company: cliente.nome_igreja,
              }] : undefined,
            },
          }),
        }
      );

      if (createCustomerResponse.ok) {
        const customerData = await createCustomerResponse.json();
        customerId = customerData.customer.id;
        console.log("Created new customer:", customerId);
      } else {
        const errorText = await createCustomerResponse.text();
        console.error("Failed to create customer:", errorText);
        // Continue without customer - will create order without customer association
      }
    }

    // Step 2: Create Draft Order
    // Convert GraphQL variant IDs to numeric IDs
    const lineItems = items.map(item => {
      // Extract numeric ID from GraphQL ID (gid://shopify/ProductVariant/123456)
      const variantIdMatch = item.variantId.match(/(\d+)$/);
      const numericVariantId = variantIdMatch ? parseInt(variantIdMatch[1]) : null;
      
      return {
        variant_id: numericVariantId,
        quantity: item.quantity,
        title: item.title,
      };
    }).filter(item => item.variant_id !== null);

    console.log("Creating draft order with line items:", lineItems);

    // Build note attributes for vendedor tracking
    const noteAttributes: Array<{ name: string; value: string }> = [];
    
    if (finalVendedorId) {
      noteAttributes.push({ name: "vendedor_id", value: finalVendedorId });
    }
    
    if (cliente.id) {
      noteAttributes.push({ name: "cliente_id", value: cliente.id });
    }

    if (isFaturamento) {
      noteAttributes.push({ name: "faturamento_prazo", value: faturamento_prazo! });
      noteAttributes.push({ name: "forma_pagamento", value: "FATURAMENTO" });
    }

    // Build tags - Shopify has a 40 character limit per tag
    const orderTags = isFaturamento ? "ebd_order,faturamento_b2b" : "ebd_order";

    // Build note with faturamento info
    let orderNote = `Pedido criado via EBD - Cliente: ${cliente.nome_igreja}`;
    if (finalVendedorId) {
      orderNote += ` | Vendedor: ${finalVendedorId}`;
    }
    if (isFaturamento) {
      orderNote += ` | FATURAMENTO ${faturamento_prazo} DIAS`;
    }

    const draftOrderPayload: Record<string, unknown> = {
      draft_order: {
        line_items: lineItems,
        note: orderNote,
        tags: orderTags,
        note_attributes: noteAttributes,
        ...(customerId && { customer: { id: customerId } }),
        use_customer_default_address: !!customerId,
      },
    };

    // Add shipping address if available
    if (cliente.endereco_rua) {
      draftOrderPayload.draft_order = {
        ...draftOrderPayload.draft_order as Record<string, unknown>,
        shipping_address: {
          first_name: cliente.nome_responsavel || cliente.nome_igreja,
          last_name: "",
          address1: `${cliente.endereco_rua}, ${cliente.endereco_numero || 'S/N'}`,
          city: cliente.endereco_cidade || "",
          province: cliente.endereco_estado || "",
          zip: cliente.endereco_cep || "",
          country: "BR",
          phone: cliente.telefone,
          company: cliente.nome_igreja,
        },
      };
    }

    // Add payment terms for B2B faturamento orders
    if (isFaturamento && faturamento_prazo) {
      const daysUntilDue = parseInt(faturamento_prazo);
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + daysUntilDue);
      
      draftOrderPayload.draft_order = {
        ...draftOrderPayload.draft_order as Record<string, unknown>,
        // Shopify payment terms: NET_XX days
        payment_terms: {
          payment_terms_name: `Líquido ${daysUntilDue} dias`,
          payment_terms_type: "NET",
          due_in_days: daysUntilDue,
        },
      };
      
      console.log("Adding payment terms:", daysUntilDue, "days, due date:", dueDate.toISOString());
    }

    const draftOrderResponse = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/draft_orders.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draftOrderPayload),
      }
    );

    if (!draftOrderResponse.ok) {
      const errorText = await draftOrderResponse.text();
      console.error("Failed to create draft order:", errorText);
      return new Response(
        JSON.stringify({ error: "Falha ao criar pedido no Shopify", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const draftOrderData = await draftOrderResponse.json();
    const draftOrder = draftOrderData.draft_order;

    console.log("Draft order created:", draftOrder.id);
    console.log("Draft order note_attributes:", draftOrder.note_attributes);

    // Step 3: For B2B faturamento, create order in Bling instead of returning checkout URL
    if (isFaturamento) {
      console.log("Faturamento B2B detected, creating order in Bling...");
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Format items for Bling - apply discount if provided
      const itensBling = items.map(item => {
        const precoOriginal = parseFloat(item.price);
        const precoComDesconto = descontoPercentual > 0 
          ? precoOriginal * (1 - descontoPercentual / 100) 
          : precoOriginal;
        
        return {
          descricao: item.title,
          unidade: 'UN',
          quantidade: item.quantity,
          valor: precoComDesconto,
          preco_cheio: precoOriginal,
        };
      });

      // Calculate totals with discount
      const valorProdutosSemDesconto = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
      const valorProdutos = descontoPercentual > 0 
        ? valorProdutosSemDesconto * (1 - descontoPercentual / 100)
        : valorProdutosSemDesconto;
      const valorTotal = valorProdutos + valorFreteRecebido;
      
      // Prepare cliente data for Bling - use nome_igreja (church name) instead of nome_responsavel
      const clienteBling = {
        nome: cliente.nome_igreja, // Changed to use church name
        cpf_cnpj: cliente.cnpj,
        email: cliente.email_superintendente,
        telefone: cliente.telefone,
      };
      
      // Prepare address for Bling
      const enderecoBling = cliente.endereco_rua ? {
        rua: cliente.endereco_rua,
        numero: cliente.endereco_numero || 'S/N',
        bairro: cliente.endereco_bairro || '',
        cep: cliente.endereco_cep || '',
        cidade: cliente.endereco_cidade || '',
        estado: cliente.endereco_estado || '',
      } : null;

      // Call bling-create-order function
      const { data: blingData, error: blingError } = await supabase.functions.invoke('bling-create-order', {
        body: {
          cliente: clienteBling,
          endereco_entrega: enderecoBling,
          itens: itensBling,
          pedido_id: draftOrder.id,
          valor_frete: valorFreteRecebido,
          metodo_frete: metodoFreteRecebido || 'free',
          forma_pagamento: 'FATURAMENTO',
          faturamento_prazo: faturamento_prazo,
          valor_produtos: valorProdutos,
          valor_total: valorTotal,
          vendedor_nome: vendedor_nome, // Pass vendor name to Bling
          desconto_percentual: descontoPercentual,
        }
      });

      if (blingError || blingData?.error) {
        const errorMessage = blingData?.error || blingError?.message || "Erro desconhecido";
        console.error("Error creating Bling order:", errorMessage);
        return new Response(
          JSON.stringify({ 
            error: errorMessage, 
            errorType: blingData?.errorType || 'BLING_ERROR',
            draftOrderId: draftOrder.id,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Bling order created successfully:", blingData);

      // Save/order update in ebd_shopify_pedidos so the vendedor can see this faturado order
      try {
        const valorTotalNumber = valorTotal;
        const valorFreteNumber = valorFreteRecebido;
        const valorParaMeta = valorTotalNumber - valorFreteNumber;

        const orderData = {
          shopify_order_id: draftOrder.id as number,
          order_number: draftOrder.name as string,
          vendedor_id: finalVendedorId || null,
          cliente_id: cliente.id || null,
          status_pagamento: "Faturado",
          valor_total: valorTotalNumber,
          valor_frete: valorFreteNumber,
          valor_para_meta: valorParaMeta,
          customer_email: cliente.email_superintendente || null,
          customer_name: cliente.nome_igreja || null,
          codigo_rastreio: null,
          url_rastreio: null,
          updated_at: new Date().toISOString(),
        };

        console.log("Saving faturado B2B order in ebd_shopify_pedidos:", orderData);

        const { error: saveError } = await supabase
          .from("ebd_shopify_pedidos")
          .upsert(orderData, {
            onConflict: "shopify_order_id",
            ignoreDuplicates: false,
          });

        if (saveError) {
          console.error("Error saving faturado B2B order in ebd_shopify_pedidos:", saveError);
        }
      } catch (dbError) {
        console.error("Unexpected error while saving faturado B2B order:", dbError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          draftOrderId: draftOrder.id,
          orderName: draftOrder.name,
          vendedorId: finalVendedorId,
          isFaturamento: true,
          faturamentoPrazo: faturamento_prazo,
          blingOrderId: blingData.bling_order_id,
          blingOrderNumber: blingData.bling_order_number,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For normal orders, return invoice URL
    const invoiceUrl = draftOrder.invoice_url;

    return new Response(
      JSON.stringify({
        success: true,
        draftOrderId: draftOrder.id,
        invoiceUrl: invoiceUrl,
        orderName: draftOrder.name,
        vendedorId: finalVendedorId,
        isFaturamento: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in ebd-shopify-order-create:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});