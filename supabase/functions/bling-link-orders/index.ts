import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to extract situacao ID (API v3 returns object {id, valor})
const getSituacaoId = (situacao: any): number | undefined => {
  if (typeof situacao === 'number') return situacao;
  if (typeof situacao === 'object' && situacao?.id) return situacao.id;
  return undefined;
};

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  return now >= expiresAt;
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log("[LINK-ORDERS] Refreshing Bling token...");
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const response = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[LINK-ORDERS] Token refresh failed:", errorText);
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("bling_config")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", config.id);

  console.log("[LINK-ORDERS] Token refreshed successfully");
  return tokenData.access_token;
}

async function blingApiCall(
  url: string, 
  accessToken: string, 
  supabase: any, 
  config: any,
  retries = 2
): Promise<{ data: any; newToken?: string }> {
  console.log(`[LINK-ORDERS] API Call: GET ${url}`);
  
  let response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  console.log(`[LINK-ORDERS] Response status: ${response.status}`);

  if (response.status === 401) {
    console.log("[LINK-ORDERS] Token expired, refreshing...");
    const newToken = await refreshBlingToken(supabase, config);
    
    await delay(400);
    
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${newToken}`,
        "Accept": "application/json",
      },
    });
    
    console.log(`[LINK-ORDERS] Retry response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bling API error after token refresh: ${response.status} - ${errorText}`);
    }
    
    return { data: await response.json(), newToken };
  }

  if (response.status === 429) {
    if (retries > 0) {
      console.log("[LINK-ORDERS] Rate limited (429), waiting 2s and retrying...");
      await delay(2000);
      return blingApiCall(url, accessToken, supabase, config, retries - 1);
    }
    throw new Error("Rate limited (429) - max retries exceeded");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bling API error: ${response.status} - ${errorText}`);
  }

  return { data: await response.json() };
}

async function fetchNfeDetails(
  blingOrderId: number, 
  accessToken: string, 
  supabase: any, 
  config: any
): Promise<{ found: boolean; nfeNumero?: string; chave?: string; linkDanfe?: string; linkXml?: string }> {
  console.log(`[LINK-ORDERS] Fetching NF-e for Bling Order ID: ${blingOrderId}`);
  
  // Step 1: Fetch order details
  const orderUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
  const { data: orderResponse, newToken: token1 } = await blingApiCall(orderUrl, accessToken, supabase, config);
  if (token1) accessToken = token1;

  const order = orderResponse?.data;
  if (!order) {
    console.log(`[LINK-ORDERS] Order ${blingOrderId} not found in Bling`);
    return { found: false };
  }

  // Step 2: Extract NF-e ID from order
  let nfeIdFromOrder: number | null = null;
  
  if (order.notaFiscal?.id && order.notaFiscal.id > 0) {
    nfeIdFromOrder = order.notaFiscal.id;
  } else if (order.nfe?.id && order.nfe.id > 0) {
    nfeIdFromOrder = order.nfe.id;
  } else if (order.idNotaFiscal && order.idNotaFiscal > 0) {
    nfeIdFromOrder = order.idNotaFiscal;
  } else if (Array.isArray(order.notasFiscais) && order.notasFiscais.length > 0) {
    const validNfes = order.notasFiscais.filter((n: any) => n.id && n.id > 0);
    if (validNfes.length > 0) {
      nfeIdFromOrder = validNfes[validNfes.length - 1].id;
    }
  }

  if (!nfeIdFromOrder) {
    console.log(`[LINK-ORDERS] No NF-e linked to order ${blingOrderId}`);
    return { found: false };
  }

  // Step 3: Fetch NF-e details
  await delay(400);
  const nfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeIdFromOrder}`;
  const { data: nfeResponse } = await blingApiCall(nfeUrl, accessToken, supabase, config);

  const nfeDetail = nfeResponse?.data;
  if (!nfeDetail) {
    console.log(`[LINK-ORDERS] NF-e ${nfeIdFromOrder} details not found`);
    return { found: false };
  }

  const situacaoId = getSituacaoId(nfeDetail.situacao);
  if (situacaoId !== 6) {
    console.log(`[LINK-ORDERS] NF-e ${nfeIdFromOrder} not authorized (situacaoId: ${situacaoId})`);
    return { found: false };
  }

  const linkDanfe = nfeDetail.linkDanfe || nfeDetail.danfe || nfeDetail.urlDanfe || nfeDetail.linkPDF || nfeDetail.link;
  const linkXml = nfeDetail.xml?.link || nfeDetail.xml || nfeDetail.linkXml || nfeDetail.urlXml;

  console.log(`[LINK-ORDERS] NF-e found: numero=${nfeDetail.numero}, linkDanfe=${linkDanfe ? 'yes' : 'no'}`);

  return {
    found: true,
    nfeNumero: String(nfeDetail.numero || ''),
    chave: nfeDetail.chaveAcesso,
    linkDanfe,
    linkXml,
  };
}

interface OrderLink {
  customer_name?: string;
  order_number?: string;
  bling_order_id: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orders } = await req.json() as { orders: OrderLink[] };
    
    console.log("=".repeat(60));
    console.log("[LINK-ORDERS] ========== INÍCIO VINCULAÇÃO ==========");
    console.log(`[LINK-ORDERS] Total de pedidos a processar: ${orders?.length || 0}`);

    if (!orders || !Array.isArray(orders) || orders.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "orders array is required" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get Bling config
    const { data: config, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .single();

    if (configError || !config) {
      console.error("[LINK-ORDERS] Error fetching config:", configError);
      throw new Error("Bling config not found");
    }

    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, config);
    }

    const results: Array<{
      customer_name?: string;
      order_number?: string;
      bling_order_id: number;
      status: string;
      shopify_order_id?: string;
      nfe_numero?: string;
      link_danfe?: string;
      error?: string;
    }> = [];

    for (const orderLink of orders) {
      const { customer_name, order_number, bling_order_id } = orderLink;
      console.log(`\n[LINK-ORDERS] Processing: customer="${customer_name}", order="${order_number}", blingId=${bling_order_id}`);

      try {
        // Step 1: Find the Shopify order
        let shopifyOrder = null;

        if (order_number) {
          // Search by order number first
          const { data } = await supabase
            .from("ebd_shopify_pedidos")
            .select("id, order_number, customer_name, bling_order_id, nota_fiscal_url")
            .eq("order_number", order_number)
            .maybeSingle();
          
          shopifyOrder = data;
        }

        if (!shopifyOrder && customer_name) {
          // Search by customer name (case-insensitive, partial match)
          const { data } = await supabase
            .from("ebd_shopify_pedidos")
            .select("id, order_number, customer_name, bling_order_id, nota_fiscal_url")
            .ilike("customer_name", `%${customer_name}%`)
            .is("bling_order_id", null) // Only orders without bling_order_id
            .eq("status_pagamento", "paid")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          shopifyOrder = data;
        }

        if (!shopifyOrder) {
          console.log(`[LINK-ORDERS] Shopify order not found for customer="${customer_name}", order="${order_number}"`);
          results.push({
            customer_name,
            order_number,
            bling_order_id,
            status: "not_found",
            error: "Shopify order not found",
          });
          continue;
        }

        console.log(`[LINK-ORDERS] Found Shopify order: id=${shopifyOrder.id}, order_number=${shopifyOrder.order_number}`);

        // Step 2: Update bling_order_id
        await supabase
          .from("ebd_shopify_pedidos")
          .update({ 
            bling_order_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", shopifyOrder.id);

        // Step 3: Fetch NF-e from Bling
        await delay(500); // Rate limit between orders
        const nfeResult = await fetchNfeDetails(bling_order_id, accessToken, supabase, config);

        if (nfeResult.found && nfeResult.linkDanfe) {
          // Update Shopify order with NF-e data
          await supabase
            .from("ebd_shopify_pedidos")
            .update({
              nota_fiscal_numero: nfeResult.nfeNumero,
              nota_fiscal_url: nfeResult.linkDanfe,
              updated_at: new Date().toISOString(),
            })
            .eq("id", shopifyOrder.id);

          // Also update commission parcels if they exist
          const { data: parcelasUpdate } = await supabase
            .from("vendedor_propostas_parcelas")
            .update({
              link_danfe: nfeResult.linkDanfe,
              nota_fiscal_numero: nfeResult.nfeNumero,
              updated_at: new Date().toISOString(),
            })
            .eq("shopify_pedido_id", shopifyOrder.id)
            .is("link_danfe", null)
            .select("id");

          console.log(`[LINK-ORDERS] Updated ${parcelasUpdate?.length || 0} commission parcels`);

          results.push({
            customer_name,
            order_number: shopifyOrder.order_number,
            bling_order_id,
            shopify_order_id: shopifyOrder.id,
            status: "linked_with_nfe",
            nfe_numero: nfeResult.nfeNumero,
            link_danfe: nfeResult.linkDanfe,
          });
        } else {
          results.push({
            customer_name,
            order_number: shopifyOrder.order_number,
            bling_order_id,
            shopify_order_id: shopifyOrder.id,
            status: "linked_no_nfe",
            error: "NF-e not found or not authorized in Bling",
          });
        }

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[LINK-ORDERS] Error processing ${customer_name || order_number}:`, errorMessage);
        results.push({
          customer_name,
          order_number,
          bling_order_id,
          status: "error",
          error: errorMessage,
        });
      }
    }

    const linked = results.filter(r => r.status === "linked_with_nfe").length;
    const linkedNoNfe = results.filter(r => r.status === "linked_no_nfe").length;
    const notFound = results.filter(r => r.status === "not_found").length;
    const errors = results.filter(r => r.status === "error").length;

    console.log("\n[LINK-ORDERS] ========== RESUMO ==========");
    console.log(`[LINK-ORDERS] Vinculados com NF-e: ${linked}`);
    console.log(`[LINK-ORDERS] Vinculados sem NF-e: ${linkedNoNfe}`);
    console.log(`[LINK-ORDERS] Não encontrados: ${notFound}`);
    console.log(`[LINK-ORDERS] Erros: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: orders.length,
          linked_with_nfe: linked,
          linked_no_nfe: linkedNoNfe,
          not_found: notFound,
          errors,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[LINK-ORDERS] ERRO GERAL:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
