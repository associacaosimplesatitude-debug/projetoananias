import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  return now >= expiresAt;
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log("[GET-NFE] Refreshing Bling token...");
  
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
    console.error("[GET-NFE] Token refresh failed:", errorText);
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

  console.log("[GET-NFE] Token refreshed successfully");
  return tokenData.access_token;
}

async function blingApiCall(
  url: string, 
  accessToken: string, 
  supabase: any, 
  config: any
): Promise<{ data: any; newToken?: string }> {
  console.log(`[GET-NFE] API Call: GET ${url}`);
  
  let response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Accept": "application/json",
    },
  });

  console.log(`[GET-NFE] Response status: ${response.status}`);

  if (response.status === 401) {
    console.log("[GET-NFE] Token expired, refreshing...");
    const newToken = await refreshBlingToken(supabase, config);
    
    await delay(400);
    
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${newToken}`,
        "Accept": "application/json",
      },
    });
    
    console.log(`[GET-NFE] Retry response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bling API error after token refresh: ${response.status} - ${errorText}`);
    }
    
    return { data: await response.json(), newToken };
  }

  if (response.status === 429) {
    console.log("[GET-NFE] Rate limited (429), waiting 2s and retrying...");
    await delay(2000);
    
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });
    
    console.log(`[GET-NFE] Retry after rate limit, status: ${response.status}`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bling API error: ${response.status} - ${errorText}`);
  }

  return { data: await response.json() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blingOrderId } = await req.json();
    
    console.log("=".repeat(60));
    console.log("[GET-NFE] ========== INÍCIO BUSCA NF-e ==========");
    console.log(`[GET-NFE] Bling Order ID recebido: ${blingOrderId}`);
    console.log(`[GET-NFE] Tipo: ${typeof blingOrderId}`);

    if (!blingOrderId) {
      console.log("[GET-NFE] ERRO: blingOrderId não fornecido");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "blingOrderId is required" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: config, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .single();

    if (configError || !config) {
      console.error("[GET-NFE] ERRO ao buscar config:", configError);
      throw new Error("Bling config not found");
    }

    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      console.log("[GET-NFE] Token expirado, renovando...");
      accessToken = await refreshBlingToken(supabase, config);
    }

    // ============================================================
    // PASSO 1: Buscar detalhes do pedido no Bling
    // ============================================================
    console.log("\n[GET-NFE] ========== PASSO 1: Buscar Pedido ==========");
    const orderUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
    
    const { data: orderResponse, newToken: token1 } = await blingApiCall(
      orderUrl, 
      accessToken, 
      supabase, 
      config
    );
    if (token1) accessToken = token1;

    const order = orderResponse?.data;
    
    if (!order) {
      console.log("[GET-NFE] Pedido não encontrado no Bling");
      return new Response(
        JSON.stringify({
          success: true,
          found: false,
          message: "Pedido não encontrado no Bling",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GET-NFE] Pedido encontrado: numero=${order.numero}, id=${order.id}`);
    console.log(`[GET-NFE] Campos disponíveis no pedido: ${Object.keys(order).join(", ")}`);
    
    // Log campos relacionados a NF-e
    const nfeRelatedFields = ["notaFiscal", "notasFiscais", "nfe", "nfes", "idNotaFiscal", "nota", "notas"];
    for (const field of nfeRelatedFields) {
      if (order[field] !== undefined) {
        console.log(`[GET-NFE] Campo '${field}' encontrado:`, JSON.stringify(order[field]));
      }
    }

    // ============================================================
    // PASSO 2: Extrair ID da NF-e do pedido (se existir)
    // ============================================================
    console.log("\n[GET-NFE] ========== PASSO 2: Extrair NF-e do Pedido ==========");
    
    let nfeIdFromOrder: number | null = null;
    
    // Tentar diferentes campos possíveis
    if (order.notaFiscal?.id) {
      nfeIdFromOrder = order.notaFiscal.id;
      console.log(`[GET-NFE] NF-e encontrada em 'notaFiscal.id': ${nfeIdFromOrder}`);
    } else if (order.nfe?.id) {
      nfeIdFromOrder = order.nfe.id;
      console.log(`[GET-NFE] NF-e encontrada em 'nfe.id': ${nfeIdFromOrder}`);
    } else if (order.idNotaFiscal) {
      nfeIdFromOrder = order.idNotaFiscal;
      console.log(`[GET-NFE] NF-e encontrada em 'idNotaFiscal': ${nfeIdFromOrder}`);
    } else if (Array.isArray(order.notasFiscais) && order.notasFiscais.length > 0) {
      // Pegar a última nota (mais recente)
      const lastNfe = order.notasFiscais[order.notasFiscais.length - 1];
      nfeIdFromOrder = lastNfe.id || lastNfe.idNotaFiscal;
      console.log(`[GET-NFE] NF-e encontrada em 'notasFiscais[]': ${nfeIdFromOrder}`);
    } else if (Array.isArray(order.nfes) && order.nfes.length > 0) {
      const lastNfe = order.nfes[order.nfes.length - 1];
      nfeIdFromOrder = lastNfe.id || lastNfe.idNotaFiscal;
      console.log(`[GET-NFE] NF-e encontrada em 'nfes[]': ${nfeIdFromOrder}`);
    }

    // ============================================================
    // PASSO 3: Se encontrou ID, buscar detalhes da NF-e
    // ============================================================
    if (nfeIdFromOrder) {
      console.log("\n[GET-NFE] ========== PASSO 3: Buscar NF-e Específica ==========");
      console.log(`[GET-NFE] Buscando NF-e ID: ${nfeIdFromOrder}`);
      
      await delay(400); // Rate limit
      
      const nfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeIdFromOrder}`;
      const { data: nfeResponse, newToken: token2 } = await blingApiCall(
        nfeUrl, 
        accessToken, 
        supabase, 
        config
      );
      if (token2) accessToken = token2;

      const nfeDetail = nfeResponse?.data;
      
      if (nfeDetail) {
        console.log(`[GET-NFE] NF-e encontrada: numero=${nfeDetail.numero}, situacao=${nfeDetail.situacao?.id}`);
        
        // Verificar se está autorizada (situacao.id === 6)
        const isAuthorized = nfeDetail.situacao?.id === 6 || nfeDetail.situacao?.valor === "Autorizada";
        
        if (isAuthorized) {
          // Buscar link do XML/DANFE
          const xmlLink = nfeDetail.xml || nfeDetail.linkXml || nfeDetail.urlXml;
          const danfeLink = nfeDetail.linkDanfe || nfeDetail.danfe || nfeDetail.urlDanfe || nfeDetail.linkPDF || nfeDetail.link;
          
          console.log(`[GET-NFE] SUCESSO! NF-e autorizada encontrada`);
          console.log(`[GET-NFE] Número: ${nfeDetail.numero}`);
          console.log(`[GET-NFE] XML: ${xmlLink || "não disponível"}`);
          console.log(`[GET-NFE] DANFE: ${danfeLink || "não disponível"}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              found: true,
              nfeId: nfeIdFromOrder,
              numero: String(nfeDetail.numero || ''),
              chave: nfeDetail.chaveAcesso,
              situacao: nfeDetail.situacao,
              url: danfeLink,
              xmlLink,
              source: "order_direct",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`[GET-NFE] NF-e encontrada mas não autorizada. Situação: ${JSON.stringify(nfeDetail.situacao)}`);
        }
      }
    } else {
      console.log("[GET-NFE] Nenhum campo de NF-e encontrado no pedido");
    }

    // ============================================================
    // PASSO 4 (FALLBACK): Listar NF-es com filtro por pedido
    // ============================================================
    console.log("\n[GET-NFE] ========== PASSO 4: Fallback - Listar NF-es ==========");
    console.log("[GET-NFE] Usando fallback: buscar NF-es autorizadas vinculadas ao pedido");
    
    await delay(400); // Rate limit
    
    // Buscar apenas NF-es autorizadas (situacao=6) vinculadas ao pedido, limite 10
    const listNfeUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${blingOrderId}&situacao=6&limite=10`;
    
    const { data: listResponse, newToken: token3 } = await blingApiCall(
      listNfeUrl, 
      accessToken, 
      supabase, 
      config
    );
    if (token3) accessToken = token3;

    const nfes = listResponse?.data || [];
    console.log(`[GET-NFE] NF-es retornadas: ${nfes.length}`);

    if (nfes.length === 0) {
      console.log("[GET-NFE] Nenhuma NF-e encontrada no fallback");
      return new Response(
        JSON.stringify({
          success: true,
          found: false,
          message: "NF-e não encontrada para este pedido",
          searchedOrderId: blingOrderId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Processar apenas as primeiras 5 NF-es para evitar rate limit
    const maxToProcess = Math.min(nfes.length, 5);
    console.log(`[GET-NFE] Processando ${maxToProcess} NF-es do fallback`);

    for (let i = 0; i < maxToProcess; i++) {
      const nfe = nfes[i];
      console.log(`\n[GET-NFE] Verificando NF-e ${i + 1}/${maxToProcess}: ID=${nfe.id}, numero=${nfe.numero}`);
      
      await delay(400); // Rate limit
      
      try {
        const nfeDetailUrl = `https://www.bling.com.br/Api/v3/nfe/${nfe.id}`;
        const { data: nfeDetailResponse } = await blingApiCall(
          nfeDetailUrl, 
          accessToken, 
          supabase, 
          config
        );

        const nfeDetail = nfeDetailResponse?.data;
        
        if (!nfeDetail) {
          console.log(`[GET-NFE] NF-e ${nfe.id}: sem detalhes, pulando`);
          continue;
        }

        // Verificar se esta NF-e está vinculada ao pedido correto
        const nfePedidoId = nfeDetail.pedidoVenda?.id;
        const nfePedidoNumero = nfeDetail.pedidoVenda?.numero;
        
        console.log(`[GET-NFE] NF-e ${nfe.numero}: pedidoVenda.id=${nfePedidoId}, pedidoVenda.numero=${nfePedidoNumero}`);
        
        // Comparar com o ID do pedido buscado
        const blingOrderIdNum = Number(blingOrderId);
        
        if (nfePedidoId && Number(nfePedidoId) === blingOrderIdNum) {
          console.log(`[GET-NFE] MATCH! NF-e ${nfe.numero} está vinculada ao pedido ${blingOrderId}`);
          
          const xmlLink = nfeDetail.xml || nfeDetail.linkXml || nfeDetail.urlXml;
          const danfeLink = nfeDetail.linkDanfe || nfeDetail.danfe || nfeDetail.urlDanfe || nfeDetail.linkPDF || nfeDetail.link;
          
          return new Response(
            JSON.stringify({
              success: true,
              found: true,
              nfeId: nfe.id,
              numero: String(nfeDetail.numero || ''),
              chave: nfeDetail.chaveAcesso,
              situacao: nfeDetail.situacao,
              url: danfeLink,
              xmlLink,
              source: "fallback_list",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          console.log(`[GET-NFE] NF-e ${nfe.numero}: pedidoVenda.id (${nfePedidoId}) != blingOrderId (${blingOrderIdNum}), pulando`);
        }
      } catch (nfeError) {
        console.error(`[GET-NFE] Erro ao buscar detalhes da NF-e ${nfe.id}:`, nfeError);
        continue;
      }
    }

    console.log("\n[GET-NFE] Nenhuma NF-e válida encontrada após verificar todas");
    return new Response(
      JSON.stringify({
        success: true,
        found: false,
        message: "NF-e não encontrada ou não vinculada corretamente a este pedido",
        searchedOrderId: blingOrderId,
        nfesVerificadas: maxToProcess,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[GET-NFE] ERRO GERAL:", errorMessage);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
