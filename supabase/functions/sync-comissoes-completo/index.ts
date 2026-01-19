import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncParams {
  dry_run: boolean;
  tolerance_steps: number[]; // [1, 3, 5] reais
}

interface VinculoResult {
  parcela_id: string;
  pedido_id: string;
  order_number: string;
  diff_valor: number;
  diff_dias: number;
  tolerance_used: number;
}

interface CandidatoTentado {
  order_number: string;
  pedido_id: string;
  valor_total: number;
  diff_valor: number;
  order_date: string | null;
  diff_dias: number | null;
  bling_order_id: number | null;
}

interface NotFoundResult {
  parcela_id: string;
  valor: number;
  created_at: string;
  data_vencimento: string | null;
  shopify_pedido_id: string | null;
  shopify_order_number: string | null;
  proposta_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  motivo: string;
  candidatos_top5: CandidatoTentado[];
}

interface AmbiguousResult {
  parcela_id: string;
  proposta_id: string | null;
  cliente_id: string;
  cliente_nome: string | null;
  valor_parcela: number;
  tolerance_used: number;
  candidatos: CandidatoTentado[];
}

interface NfeError {
  bling_order_id: number;
  order_number: string;
  motivo: string;
  payload_resumido?: any;
}

interface DanfePropagado {
  parcela_id: string;
  pedido_id: string;
  order_number: string;
  nota_fiscal_numero: string;
  link_danfe: string;
}

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() > expirationDate.getTime() - bufferMs;
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log("Refreshing Bling token...");
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const response = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase.from("bling_config").update({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  }).eq("id", config.id);

  return tokenData.access_token;
}

async function blingApiCall(
  endpoint: string,
  accessToken: string,
  supabase: any,
  config: any
): Promise<{ data: any; newToken?: string }> {
  let token = accessToken;
  
  const makeRequest = async (t: string) => {
    const response = await fetch(`https://api.bling.com.br/Api/v3${endpoint}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${t}`,
        Accept: "application/json",
      },
    });
    return response;
  };

  let response = await makeRequest(token);

  if (response.status === 401) {
    console.log("Token expired, refreshing...");
    token = await refreshBlingToken(supabase, config);
    response = await makeRequest(token);
  }

  if (response.status === 429) {
    console.log("Rate limited, waiting 1 second...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    response = await makeRequest(token);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bling API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return { data, newToken: token !== accessToken ? token : undefined };
}

function extractNfeId(orderData: any): number | null {
  if (orderData.notasFiscais && orderData.notasFiscais.length > 0) {
    return orderData.notasFiscais[0].id;
  }
  if (orderData.notaFiscal?.id) {
    return orderData.notaFiscal.id;
  }
  if (orderData.nfe?.id) {
    return orderData.nfe.id;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const params: SyncParams = {
      dry_run: body.dry_run ?? true,
      tolerance_steps: body.tolerance_steps ?? [1, 3, 5],
    };

    console.log("=== SYNC COMISSOES COMPLETO ===");
    console.log("Params:", params);

    // Get Bling config
    const { data: blingConfig, error: blingError } = await supabase
      .from("bling_config")
      .select("*")
      .single();

    if (blingError || !blingConfig) {
      throw new Error("Bling config not found");
    }

    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Results
    const vinculados: VinculoResult[] = [];
    const ambiguous: AmbiguousResult[] = [];
    const notFound: NotFoundResult[] = [];
    const nfeErrors: NfeError[] = [];
    const danfesPropagados: DanfePropagado[] = [];

    // ============================================
    // ETAPA 1: Carregar todos os dados necessários
    // ============================================
    console.log("\n=== ETAPA 1: Carregando dados ===");

    // 1.1 Parcelas liberadas sem DANFE
    const { data: parcelasLiberadas, error: parcelasError } = await supabase
      .from("vendedor_propostas_parcelas")
      .select(`
        id,
        proposta_id,
        numero_parcela,
        valor,
        data_vencimento,
        comissao_status,
        shopify_pedido_id,
        link_danfe,
        nota_fiscal_numero,
        created_at,
        vendedor_id
      `)
      .eq("comissao_status", "liberada")
      .is("link_danfe", null);

    if (parcelasError) throw new Error(`Error fetching parcelas: ${parcelasError.message}`);
    console.log(`Parcelas liberadas sem DANFE: ${parcelasLiberadas?.length || 0}`);

    // 1.2 Propostas (para obter cliente_id)
    const propostaIds = [...new Set(parcelasLiberadas?.map((p: any) => p.proposta_id).filter(Boolean) || [])];
    
    let propostaMap = new Map<string, any>();
    if (propostaIds.length > 0) {
      const { data: propostas, error: propostasError } = await supabase
        .from("vendedor_propostas")
        .select("id, cliente_id, vendedor_id, valor_total, created_at")
        .in("id", propostaIds);

      if (propostasError) throw new Error(`Error fetching propostas: ${propostasError.message}`);
      propostaMap = new Map(propostas?.map((p: any) => [p.id, p]) || []);
    }

    // 1.3 Digital proposals (#D*) para obter cliente_id quando proposta_id é null
    const { data: digitalProposals, error: digitalError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id, cliente_id, order_number, valor_total, order_date")
      .like("order_number", "#D%");

    if (digitalError) console.error("Error fetching digital proposals:", digitalError.message);
    const digitalProposalMap = new Map(digitalProposals?.map((dp: any) => [dp.id, dp]) || []);

    // 1.4 ALL real Shopify orders (both with and without bling_order_id for matching)
    const { data: allShopifyOrders, error: shopifyError } = await supabase
      .from("ebd_shopify_pedidos")
      .select(`
        id,
        cliente_id,
        order_number,
        valor_total,
        order_date,
        bling_order_id,
        nota_fiscal_url,
        nota_fiscal_numero
      `)
      .not("order_number", "like", "#D%");

    if (shopifyError) throw new Error(`Error fetching Shopify orders: ${shopifyError.message}`);
    console.log(`Total real Shopify orders: ${allShopifyOrders?.length || 0}`);

    // Filter for orders with bling_order_id (can get NF-e)
    const ordersWithBlingId = allShopifyOrders?.filter((o: any) => o.bling_order_id) || [];
    console.log(`Orders with bling_order_id: ${ordersWithBlingId.length}`);

    // 1.5 Client names
    const allClienteIds = [...new Set([
      ...Array.from(propostaMap.values()).map((p: any) => p.cliente_id).filter(Boolean),
      ...allShopifyOrders?.map((o: any) => o.cliente_id).filter(Boolean) || [],
      ...digitalProposals?.map((d: any) => d.cliente_id).filter(Boolean) || [],
    ])];

    let clienteMap = new Map<string, string>();
    if (allClienteIds.length > 0) {
      const { data: clientes, error: clientesError } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", allClienteIds);

      clienteMap = new Map(clientes?.map((c: any) => [c.id, c.nome_igreja]) || []);
    }

    // Group real Shopify orders by cliente_id (include all, not just with bling_order_id)
    const ordersByCliente = new Map<string, any[]>();
    for (const order of allShopifyOrders || []) {
      if (!order.cliente_id) continue;
      if (!ordersByCliente.has(order.cliente_id)) {
        ordersByCliente.set(order.cliente_id, []);
      }
      ordersByCliente.get(order.cliente_id)!.push(order);
    }

    // ============================================
    // ETAPA 2: Processar cada parcela
    // ============================================
    console.log("\n=== ETAPA 2: Processando parcelas ===");

    for (const parcela of parcelasLiberadas || []) {
      const valorParcela = parcela.valor || 0;

      // --- REGRA 1: Se shopify_pedido_id já aponta para pedido REAL com bling_order_id ---
      if (parcela.shopify_pedido_id) {
        const existingOrder = allShopifyOrders?.find((o: any) => o.id === parcela.shopify_pedido_id);
        
        // Check if it's a real order (not #D*)
        if (existingOrder && !existingOrder.order_number.startsWith("#D")) {
          // Already linked to real order - skip revinculação, just check for DANFE later
          console.log(`Parcela ${parcela.id} já vinculada a ${existingOrder.order_number} - skip`);
          continue;
        }
      }

      // --- Determinar cliente_id ---
      let clienteId: string | null = null;
      let clienteNome: string | null = null;
      let shopifyOrderNumber: string | null = null;

      // Try from proposta first
      const proposta = propostaMap.get(parcela.proposta_id);
      if (proposta?.cliente_id) {
        clienteId = proposta.cliente_id;
      }

      // If no proposta or no cliente_id, try from digital proposal (#D*)
      if (!clienteId && parcela.shopify_pedido_id) {
        const digitalProposal = digitalProposalMap.get(parcela.shopify_pedido_id);
        if (digitalProposal) {
          clienteId = digitalProposal.cliente_id;
          shopifyOrderNumber = digitalProposal.order_number;
        }
      }

      clienteNome = clienteId ? (clienteMap.get(clienteId) || null) : null;

      // --- Validar cliente_id ---
      if (!clienteId) {
        notFound.push({
          parcela_id: parcela.id,
          valor: valorParcela,
          created_at: parcela.created_at,
          data_vencimento: parcela.data_vencimento,
          shopify_pedido_id: parcela.shopify_pedido_id,
          shopify_order_number: shopifyOrderNumber,
          proposta_id: parcela.proposta_id,
          cliente_id: null,
          cliente_nome: null,
          motivo: "missing_cliente_id",
          candidatos_top5: [],
        });
        continue;
      }

      // --- Buscar orders do cliente ---
      const clientOrders = ordersByCliente.get(clienteId) || [];

      if (clientOrders.length === 0) {
        notFound.push({
          parcela_id: parcela.id,
          valor: valorParcela,
          created_at: parcela.created_at,
          data_vencimento: parcela.data_vencimento,
          shopify_pedido_id: parcela.shopify_pedido_id,
          shopify_order_number: shopifyOrderNumber,
          proposta_id: parcela.proposta_id,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          motivo: "no_shopify_orders_for_cliente",
          candidatos_top5: [],
        });
        continue;
      }

      // --- REGRA 2 e 3: Tentar match com tolerância em degraus ---
      // Calculate date reference for tiebreaker (NOT elimination)
      const parcelaDate = parcela.created_at ? new Date(parcela.created_at) : null;
      const vencimentoDate = parcela.data_vencimento ? new Date(parcela.data_vencimento) : null;
      const refDate = parcelaDate || vencimentoDate;

      // Build candidatos with diff_valor
      const candidatos: CandidatoTentado[] = clientOrders.map((order: any) => {
        const diffValor = Math.abs(valorParcela - (order.valor_total || 0));
        const orderDate = order.order_date ? new Date(order.order_date) : null;
        const diffDias = refDate && orderDate
          ? Math.abs(Math.round((refDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        return {
          order_number: order.order_number,
          pedido_id: order.id,
          valor_total: order.valor_total || 0,
          diff_valor: diffValor,
          order_date: order.order_date,
          diff_dias: diffDias,
          bling_order_id: order.bling_order_id,
        };
      });

      // Sort by diff_valor, then by diff_dias (null goes last)
      candidatos.sort((a, b) => {
        if (a.diff_valor !== b.diff_valor) return a.diff_valor - b.diff_valor;
        if (a.diff_dias === null && b.diff_dias === null) return 0;
        if (a.diff_dias === null) return 1;
        if (b.diff_dias === null) return -1;
        return a.diff_dias - b.diff_dias;
      });

      // Try each tolerance step
      let matched = false;
      for (const tolerance of params.tolerance_steps) {
        const matches = candidatos.filter((c) => c.diff_valor <= tolerance);

        if (matches.length === 0) continue;

        if (matches.length === 1) {
          // Unique match found
          const match = matches[0];

          if (!params.dry_run) {
            await supabase
              .from("vendedor_propostas_parcelas")
              .update({ shopify_pedido_id: match.pedido_id })
              .eq("id", parcela.id);
          }

          vinculados.push({
            parcela_id: parcela.id,
            pedido_id: match.pedido_id,
            order_number: match.order_number,
            diff_valor: match.diff_valor,
            diff_dias: match.diff_dias || 0,
            tolerance_used: tolerance,
          });

          matched = true;
          break;
        } else {
          // Multiple matches - ambiguous
          // Only mark as ambiguous at the last tolerance step to allow narrowing
          if (tolerance === params.tolerance_steps[params.tolerance_steps.length - 1]) {
            ambiguous.push({
              parcela_id: parcela.id,
              proposta_id: parcela.proposta_id,
              cliente_id: clienteId,
              cliente_nome: clienteNome,
              valor_parcela: valorParcela,
              tolerance_used: tolerance,
              candidatos: matches,
            });
            matched = true;
          }
        }
      }

      if (!matched) {
        // No match found even at max tolerance
        notFound.push({
          parcela_id: parcela.id,
          valor: valorParcela,
          created_at: parcela.created_at,
          data_vencimento: parcela.data_vencimento,
          shopify_pedido_id: parcela.shopify_pedido_id,
          shopify_order_number: shopifyOrderNumber,
          proposta_id: parcela.proposta_id,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          motivo: candidatos.length > 0 
            ? `no_match_within_tolerance (min_diff: ${candidatos[0].diff_valor.toFixed(2)})`
            : "no_candidates",
          candidatos_top5: candidatos.slice(0, 5),
        });
      }
    }

    console.log(`Vinculados: ${vinculados.length}, Ambiguous: ${ambiguous.length}, Not Found: ${notFound.length}`);

    // ============================================
    // ETAPA 3: Buscar NF-e do Bling
    // ============================================
    console.log("\n=== ETAPA 3: Buscar NF-e do Bling ===");

    // Get orders that need NF-e update (have bling_order_id but no nota_fiscal_url)
    const ordersNeedingNfe = allShopifyOrders?.filter((o: any) => 
      o.bling_order_id && !o.nota_fiscal_url
    ) || [];

    console.log(`Orders needing NF-e fetch: ${ordersNeedingNfe.length}`);

    // Build map of order.id -> NF-e info
    const orderNfeMap = new Map<string, { url: string; numero: string; orderNumber: string }>();

    // Pre-populate with existing NF-e data
    for (const order of allShopifyOrders || []) {
      if (order.nota_fiscal_url) {
        orderNfeMap.set(order.id, {
          url: order.nota_fiscal_url,
          numero: order.nota_fiscal_numero || "",
          orderNumber: order.order_number,
        });
      }
    }

    let nfesBuscadas = 0;
    let nfesEncontradas = 0;
    const ordersToUpdate: { id: string; url: string; numero: string; orderNumber: string }[] = [];

    for (const order of ordersNeedingNfe) {
      try {
        nfesBuscadas++;
        
        // Rate limiting
        if (nfesBuscadas > 1 && nfesBuscadas % 5 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        // Fetch order details from Bling
        const { data: orderData, newToken } = await blingApiCall(
          `/pedidos/vendas/${order.bling_order_id}`,
          accessToken,
          supabase,
          blingConfig
        );

        if (newToken) accessToken = newToken;

        const orderDetail = orderData?.data;
        if (!orderDetail) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: "order_not_found_in_bling",
          });
          continue;
        }

        // Extract NF-e ID
        const nfeId = extractNfeId(orderDetail);
        
        if (!nfeId) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: "nfeId_missing",
            payload_resumido: {
              hasNotasFiscais: !!orderDetail.notasFiscais,
              notasFiscaisLength: orderDetail.notasFiscais?.length || 0,
            },
          });
          continue;
        }

        // Fetch NF-e details
        const { data: nfeData, newToken: newToken2 } = await blingApiCall(
          `/nfe/${nfeId}`,
          accessToken,
          supabase,
          blingConfig
        );

        if (newToken2) accessToken = newToken2;

        const nfeDetail = nfeData?.data;
        if (!nfeDetail) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: "nfe_not_found",
          });
          continue;
        }

        // Check if NF-e is authorized
        const situacaoId = nfeDetail.situacao?.id || nfeDetail.situacao;
        if (situacaoId !== 6) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: `nfe_not_authorized (situacao: ${situacaoId})`,
          });
          continue;
        }

        // Extract DANFE link
        const linkDanfe = nfeDetail.linkDanfe || nfeDetail.xml?.linkDanfe;
        const nfNumero = nfeDetail.numero?.toString() || "";

        if (!linkDanfe) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: "linkDanfe_missing",
          });
          continue;
        }

        nfesEncontradas++;
        
        // Add to map for propagation
        orderNfeMap.set(order.id, {
          url: linkDanfe,
          numero: nfNumero,
          orderNumber: order.order_number,
        });

        ordersToUpdate.push({
          id: order.id,
          url: linkDanfe,
          numero: nfNumero,
          orderNumber: order.order_number,
        });

        console.log(`✓ NF-e found for ${order.order_number}: ${nfNumero}`);

      } catch (error: any) {
        console.error(`Error processing order ${order.order_number}:`, error.message);
        nfeErrors.push({
          bling_order_id: order.bling_order_id,
          order_number: order.order_number,
          motivo: `api_error: ${error.message}`,
        });
      }
    }

    console.log(`NF-es buscadas: ${nfesBuscadas}, encontradas: ${nfesEncontradas}`);

    // Update ebd_shopify_pedidos with NF-e data
    if (!params.dry_run && ordersToUpdate.length > 0) {
      console.log(`Updating ${ordersToUpdate.length} orders with NF-e data...`);
      for (const order of ordersToUpdate) {
        await supabase
          .from("ebd_shopify_pedidos")
          .update({
            nota_fiscal_url: order.url,
            nota_fiscal_numero: order.numero,
          })
          .eq("id", order.id);
      }
    }

    // ============================================
    // ETAPA 4: Propagar DANFE para Parcelas
    // ============================================
    console.log("\n=== ETAPA 4: Propagar DANFE para Parcelas ===");

    // Build map of parcela_id -> new shopify_pedido_id from vinculados
    const vinculadosMap = new Map(vinculados.map((v) => [v.parcela_id, v.pedido_id]));

    console.log(`Orders with NF-e available for propagation: ${orderNfeMap.size}`);

    // Get all parcelas that could benefit from propagation
    const { data: parcelasToPropagateCheck, error: propagateCheckError } = await supabase
      .from("vendedor_propostas_parcelas")
      .select(`id, shopify_pedido_id, link_danfe`)
      .eq("comissao_status", "liberada")
      .is("link_danfe", null);

    if (propagateCheckError) throw new Error(`Error fetching parcelas for propagation: ${propagateCheckError.message}`);

    console.log(`Parcelas to check for propagation: ${parcelasToPropagateCheck?.length || 0}`);

    for (const parcela of parcelasToPropagateCheck || []) {
      // Check if this parcela was revinculada in this run
      const newPedidoId = vinculadosMap.get(parcela.id);
      const pedidoIdToUse = newPedidoId || parcela.shopify_pedido_id;
      
      if (!pedidoIdToUse) continue;

      const nfeInfo = orderNfeMap.get(pedidoIdToUse);
      
      if (nfeInfo && nfeInfo.url) {
        if (!params.dry_run) {
          await supabase
            .from("vendedor_propostas_parcelas")
            .update({
              shopify_pedido_id: pedidoIdToUse,
              link_danfe: nfeInfo.url,
              nota_fiscal_numero: nfeInfo.numero,
            })
            .eq("id", parcela.id);
        }

        danfesPropagados.push({
          parcela_id: parcela.id,
          pedido_id: pedidoIdToUse,
          order_number: nfeInfo.orderNumber,
          nota_fiscal_numero: nfeInfo.numero || "",
          link_danfe: nfeInfo.url,
        });
      }
    }

    console.log(`DANFEs propagados: ${danfesPropagados.length}`);

    // ============================================
    // Resultado Final
    // ============================================
    const result = {
      success: true,
      dry_run: params.dry_run,
      tolerance_steps: params.tolerance_steps,
      summary: {
        parcelas_processadas: parcelasLiberadas?.length || 0,
        vinculos_criados: vinculados.length,
        nfes_buscadas_bling: nfesBuscadas,
        nfes_encontradas: nfesEncontradas,
        orders_atualizados_nfe: ordersToUpdate.length,
        danfes_propagados: danfesPropagados.length,
        ambiguous: ambiguous.length,
        not_found: notFound.length,
        nfe_errors: nfeErrors.length,
      },
      vinculados,
      ambiguous,
      not_found: notFound,
      nfe_errors: nfeErrors,
      danfes_propagados: danfesPropagados,
    };

    console.log("\n=== RESULTADO FINAL ===");
    console.log("Summary:", result.summary);

    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in sync-comissoes-completo:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
