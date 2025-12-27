import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
const SHOPIFY_API_VERSION = "2024-01";

// ========== BLING INTEGRATION ==========
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('[BLING] Renovando token...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error) {
    console.error('[BLING] Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('[BLING] Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('[BLING] Token renovado com sucesso!');
  return tokenData.access_token;
}

async function getBlingAccessToken(supabase: any): Promise<string | null> {
  const { data: config, error } = await supabase
    .from('bling_config')
    .select('*')
    .single();

  if (error || !config) {
    console.error('[BLING] Erro ao buscar config:', error);
    return null;
  }

  // Check if token is expired
  const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;
  const now = new Date();
  
  if (expiresAt && now >= expiresAt) {
    // Token expired, refresh it
    try {
      return await refreshBlingToken(supabase, config);
    } catch (e) {
      console.error('[BLING] Falha ao renovar token:', e);
      return null;
    }
  }

  return config.access_token;
}

interface BlingOrderSearchResult {
  customerDocument: string | null;
  customerName: string | null;
}

async function fetchCpfCnpjFromBling(
  accessToken: string,
  shopifyOrderNumber: string
): Promise<BlingOrderSearchResult> {
  // Shopify order numbers come like "#1944", we need to clean them
  const cleanOrderNumber = shopifyOrderNumber.replace(/^#/, '');
  
  // Search for order in Bling by store order number
  // The parameter numeroPedidoLoja filters by the original order number from the e-commerce
  const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?numeroPedidoLoja=${cleanOrderNumber}&limite=5`;
  
  console.log(`[BLING] Buscando pedido ${cleanOrderNumber}: ${searchUrl}`);
  
  try {
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[BLING] Erro ao buscar pedido ${cleanOrderNumber}: ${response.status}`);
      return { customerDocument: null, customerName: null };
    }

    const json = await response.json();
    const orders = json?.data || [];
    
    if (orders.length === 0) {
      console.log(`[BLING] Nenhum pedido encontrado para ${cleanOrderNumber}`);
      return { customerDocument: null, customerName: null };
    }

    // Get the first matching order
    const blingOrder = orders[0];
    console.log(`[BLING] Pedido encontrado: ID ${blingOrder.id}, Contato: ${JSON.stringify(blingOrder.contato)}`);
    
    const customerDocument = blingOrder.contato?.numeroDocumento || null;
    const customerName = blingOrder.contato?.nome || null;

    if (customerDocument) {
      console.log(`[BLING] CPF/CNPJ encontrado para ${cleanOrderNumber}: ${customerDocument}`);
    }

    return { customerDocument, customerName };
  } catch (e) {
    console.error(`[BLING] Erro ao buscar pedido ${cleanOrderNumber}:`, e);
    return { customerDocument: null, customerName: null };
  }
}
interface ShopifyLineItem {
  id: number;
  title: string;
  variant_title: string | null;
  quantity: number;
  price: string;
  sku: string | null;
  product_id: number | null;
  variant_id: number | null;
}

interface ShopifyOrder {
  id: number;
  name: string;
  email: string;
  financial_status: string;
  total_price: string;
  total_shipping_price_set?: {
    shop_money?: {
      amount: string;
    };
  };
  shipping_lines?: Array<{
    price: string;
  }>;
  customer?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    default_address?: {
      address1?: string;
      address2?: string;
      city?: string;
      province?: string;
      province_code?: string;
      zip?: string;
      country?: string;
      phone?: string;
    };
  };
  shipping_address?: {
    first_name?: string;
    last_name?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    province_code?: string;
    zip?: string;
    country?: string;
    phone?: string;
    name?: string;
  };
  note_attributes?: Array<{ name: string; value: string }>;
  fulfillments?: Array<{
    tracking_number?: string;
    tracking_url?: string;
  }>;
  line_items?: ShopifyLineItem[];
  created_at: string;
}

function getNextPageInfo(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const matches = linkHeader.match(/<[^>]+page_info=([^>&]+)[^>]*>;\s*rel="next"/);
  return matches ? matches[1] : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyAccessToken = Deno.env.get("SHOPIFY_CENTRAL_GOSPEL_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!shopifyAccessToken || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing required environment variables");
    }

    // AuthZ: this function is public at the gateway level (verify_jwt=false) to allow CORS preflight,
    // but we still REQUIRE a valid user token + admin role for POST.
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("Role check error:", roleError);
      return new Response(JSON.stringify({ success: false, error: "Role check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isAdmin) {
      return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const financialStatus = body.financial_status || "paid";
    const status = body.status || "any";
    const createdAtMin = body.created_at_min as string | undefined;
    const createdAtMax = body.created_at_max as string | undefined;
    const syncItems = body.sync_items === true;

    console.log(
      `Syncing orders with financial_status: ${financialStatus}, status: ${status}, created_at_min: ${createdAtMin ?? "-"}, created_at_max: ${createdAtMax ?? "-"}, sync_items: ${syncItems}`
    );

    let allOrders: ShopifyOrder[] = [];
    let pageInfo: string | null = null;

    // Fetch orders with pagination
    do {
      const baseUrl = `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
      const url = pageInfo
        ? `${baseUrl}?limit=250&page_info=${pageInfo}`
        : (() => {
            const params = new URLSearchParams({
              limit: "250",
              status,
              financial_status: financialStatus,
            });
            if (createdAtMin) params.set("created_at_min", createdAtMin);
            if (createdAtMax) params.set("created_at_max", createdAtMax);
            return `${baseUrl}?${params.toString()}`;
          })();

      console.log(`Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          "X-Shopify-Access-Token": shopifyAccessToken,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      allOrders = allOrders.concat(data.orders || []);

      const linkHeader = response.headers.get("Link");
      pageInfo = getNextPageInfo(linkHeader);

      console.log(`Fetched ${data.orders?.length || 0} orders, total: ${allOrders.length}`);
    } while (pageInfo);

    console.log(`Total orders fetched: ${allOrders.length}`);

    // Process and upsert orders
    const ordersToUpsert = allOrders.map((order, index) => {
      // DEBUG: Log raw order JSON for first 3 orders to identify CPF/CNPJ location
      if (index < 3) {
        console.log(`=== DEBUG ORDER #${order.name} RAW JSON ===`);
        console.log(`note_attributes: ${JSON.stringify(order.note_attributes)}`);
        console.log(`billing_address: ${JSON.stringify((order as any).billing_address)}`);
        console.log(`customer FULL: ${JSON.stringify(order.customer)}`);
        console.log(`order.note: ${(order as any).note}`);
        console.log(`order.tags: ${(order as any).tags}`);
        console.log(`order.phone: ${(order as any).phone}`);
        // Log metafields if available
        if ((order as any).metafields) console.log(`metafields: ${JSON.stringify((order as any).metafields)}`);
        console.log(`=== END DEBUG ORDER #${order.name} ===`);
      }

      const shippingPrice =
        order.total_shipping_price_set?.shop_money?.amount ||
        order.shipping_lines?.[0]?.price ||
        "0";

      const customerName = order.customer
        ? `${order.customer.first_name || ""} ${order.customer.last_name || ""}`.trim()
        : order.shipping_address?.name || "";

      const tracking = order.fulfillments?.[0];

      // Extract CPF/CNPJ - check multiple possible locations
      let customerDocument: string | null = null;
      
      // 1. Check note_attributes (common for checkout apps)
      if (order.note_attributes && order.note_attributes.length > 0) {
        const cpfAttr = order.note_attributes.find((a) => {
          const nameLower = a.name.toLowerCase();
          return nameLower.includes("cpf") || 
                 nameLower.includes("cnpj") || 
                 nameLower.includes("documento") ||
                 nameLower.includes("document") ||
                 nameLower.includes("tax") ||
                 nameLower.includes("nif") ||
                 nameLower.includes("vat");
        });
        if (cpfAttr) {
          customerDocument = cpfAttr.value;
          console.log(`Found CPF/CNPJ in note_attributes for order ${order.name}: ${customerDocument}`);
        }
      }
      
      // 2. Check address2 field (some stores put CPF there)
      if (!customerDocument && order.shipping_address?.address2) {
        const addr2 = order.shipping_address.address2;
        // Check if address2 looks like a CPF/CNPJ (contains mostly numbers)
        const numbersOnly = addr2.replace(/\D/g, "");
        if (numbersOnly.length === 11 || numbersOnly.length === 14) {
          customerDocument = addr2;
          console.log(`Found CPF/CNPJ in address2 for order ${order.name}: ${customerDocument}`);
        }
      }
      
      // 3. Check customer default_address.address2
      if (!customerDocument && order.customer?.default_address?.address2) {
        const addr2 = order.customer.default_address.address2;
        const numbersOnly = addr2.replace(/\D/g, "");
        if (numbersOnly.length === 11 || numbersOnly.length === 14) {
          customerDocument = addr2;
          console.log(`Found CPF/CNPJ in customer.default_address.address2 for order ${order.name}: ${customerDocument}`);
        }
      }

      // 4. Check order note field
      const orderAny = order as any;
      if (!customerDocument && orderAny.note) {
        const noteStr = String(orderAny.note);
        // Try to extract CPF/CNPJ pattern from note
        const cpfMatch = noteStr.match(/(?:cpf|cnpj|documento)[:\s]*([0-9.\-\/]+)/i);
        if (cpfMatch) {
          customerDocument = cpfMatch[1];
          console.log(`Found CPF/CNPJ in note for order ${order.name}: ${customerDocument}`);
        }
      }

      // Extract shipping address
      const ship = order.shipping_address;

      return {
        shopify_order_id: order.id,
        order_number: order.name,
        status_pagamento: order.financial_status,
        customer_email: order.customer?.email || order.email,
        customer_name: customerName,
        valor_total: parseFloat(order.total_price) || 0,
        valor_frete: parseFloat(shippingPrice) || 0,
        codigo_rastreio: tracking?.tracking_number || null,
        url_rastreio: tracking?.tracking_url || null,
        // CPF / CNPJ
        customer_document: customerDocument,
        // Address
        endereco_rua: ship?.address1 || null,
        endereco_numero: null, // Shopify não separa número; está dentro de address1
        endereco_complemento: ship?.address2 || null,
        endereco_bairro: null, // Shopify não tem campo separado; pode estar em address2
        endereco_cidade: ship?.city || null,
        endereco_estado: ship?.province_code || ship?.province || null,
        endereco_cep: ship?.zip || null,
        endereco_nome: ship?.name || null,
        endereco_telefone: ship?.phone || null,
        // IMPORTANT: use Shopify's real order date for metrics
        order_date: order.created_at,
        // Keep created_at aligned to the real order date as well (legacy screens still use created_at)
        created_at: order.created_at,
        updated_at: new Date().toISOString(),
      };
    });

    if (ordersToUpsert.length > 0) {
      const { error } = await supabase
        .from("ebd_shopify_pedidos_cg")
        .upsert(ordersToUpsert, { onConflict: "shopify_order_id" });

      if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
      }
    }

    // ========== PASSO 2: BUSCAR CPF/CNPJ NO BLING PARA PEDIDOS SEM DOCUMENTO ==========
    console.log("[BLING] Iniciando busca de CPF/CNPJ para pedidos sem documento...");
    
    // Get orders that don't have customer_document
    const { data: ordersWithoutDocument, error: fetchError } = await supabase
      .from("ebd_shopify_pedidos_cg")
      .select("id, order_number, customer_document")
      .is("customer_document", null)
      .order("created_at", { ascending: false })
      .limit(100); // Limitar para não sobrecarregar

    if (fetchError) {
      console.error("[BLING] Erro ao buscar pedidos sem documento:", fetchError);
    } else if (ordersWithoutDocument && ordersWithoutDocument.length > 0) {
      console.log(`[BLING] ${ordersWithoutDocument.length} pedidos sem CPF/CNPJ. Buscando no Bling...`);
      
      // Get Bling access token
      const blingToken = await getBlingAccessToken(supabase);
      
      if (blingToken) {
        let blingUpdates = 0;
        
        for (const order of ordersWithoutDocument) {
          try {
            const result = await fetchCpfCnpjFromBling(blingToken, order.order_number);
            
            if (result.customerDocument) {
              // Update the order with CPF/CNPJ from Bling
              const { error: updateError } = await supabase
                .from("ebd_shopify_pedidos_cg")
                .update({ 
                  customer_document: result.customerDocument,
                  updated_at: new Date().toISOString()
                })
                .eq("id", order.id);
              
              if (updateError) {
                console.error(`[BLING] Erro ao atualizar pedido ${order.order_number}:`, updateError);
              } else {
                console.log(`[BLING] ✓ CPF/CNPJ atualizado para pedido ${order.order_number}: ${result.customerDocument}`);
                blingUpdates++;
              }
            }
            
            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
          } catch (e) {
            console.error(`[BLING] Erro ao processar pedido ${order.order_number}:`, e);
          }
        }
        
        console.log(`[BLING] Total de pedidos atualizados com CPF/CNPJ do Bling: ${blingUpdates}`);
      } else {
        console.warn("[BLING] Token não disponível. Pulando busca de CPF/CNPJ no Bling.");
      }
    } else {
      console.log("[BLING] Todos os pedidos já possuem CPF/CNPJ ou nenhum pedido encontrado.");
    }

    // Optionally sync line items (can be heavy and trigger gateway 5xx).
    let totalItemsSynced = 0;

    if (syncItems) {
      for (const order of allOrders) {
        if (!order.line_items || order.line_items.length === 0) continue;

        // First, get the pedido_id from our database
        const { data: pedidoData, error: pedidoError } = await supabase
          .from("ebd_shopify_pedidos_cg")
          .select("id")
          .eq("shopify_order_id", order.id)
          .single();

        if (pedidoError || !pedidoData) {
          console.error(`Could not find pedido for shopify_order_id ${order.id}`);
          continue;
        }

        const itemsToUpsert = order.line_items.map((item) => ({
          pedido_id: pedidoData.id,
          shopify_line_item_id: item.id,
          product_title: item.title,
          variant_title: item.variant_title,
          quantity: item.quantity,
          price: parseFloat(item.price) || 0,
          sku: item.sku,
        }));

        const { error: itemsError } = await supabase
          .from("ebd_shopify_pedidos_cg_itens")
          .upsert(itemsToUpsert, { onConflict: "shopify_line_item_id" });

        if (itemsError) {
          console.error(`Error upserting items for order ${order.name}:`, itemsError);
        } else {
          totalItemsSynced += itemsToUpsert.length;
        }
      }

      console.log(`Total line items synced: ${totalItemsSynced}`);
    } else {
      console.log("Skipping line items sync (sync_items=false)");
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: ordersToUpsert.length,
        items_synced: totalItemsSynced,
        message: `Synced ${ordersToUpsert.length} orders and ${totalItemsSynced} line items from Central Gospel store`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error syncing orders:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
