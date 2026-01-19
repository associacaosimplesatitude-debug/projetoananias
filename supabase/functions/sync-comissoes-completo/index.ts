import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyncParams {
  dry_run: boolean;
  tolerance_value: number;
  tolerance_days: number;
}

interface VinculoResult {
  parcela_id: string;
  pedido_id: string;
  order_number: string;
  diff_valor: number;
  diff_dias: number;
}

interface CandidatoTentado {
  order_number: string;
  pedido_id: string;
  valor_total: number;
  diff_valor: number;
  order_date: string;
  diff_dias: number;
  motivo_rejeicao: string | null;
}

interface NotFoundResult {
  parcela_id: string;
  proposta_id: string;
  motivo: string;
  cliente_id: string | null;
  cliente_nome: string | null;
  valor_parcela: number;
  data_referencia: string | null;
  candidatos_tentados: CandidatoTentado[];
}

interface AmbiguousResult {
  parcela_id: string;
  proposta_id: string;
  motivo: string;
  cliente_id: string;
  cliente_nome: string;
  valor_parcela: number;
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
  // Check multiple possible paths for NF-e ID
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
      tolerance_value: body.tolerance_value ?? 1.0,
      tolerance_days: body.tolerance_days ?? 7,
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
    // ETAPA 1: Buscar parcelas liberadas sem DANFE
    // ============================================
    console.log("\n=== ETAPA 1: Revinculação de Parcelas ===");

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
        created_at
      `)
      .eq("comissao_status", "liberada")
      .is("link_danfe", null);

    if (parcelasError) {
      throw new Error(`Error fetching parcelas: ${parcelasError.message}`);
    }

    console.log(`Found ${parcelasLiberadas?.length || 0} parcelas liberadas sem DANFE`);

    // Get all proposals for these parcels
    const propostaIds = [...new Set(parcelasLiberadas?.map((p: any) => p.proposta_id).filter(Boolean) || [])];
    
    let propostas: any[] = [];
    if (propostaIds.length > 0) {
      const { data: propostasData, error: propostasError } = await supabase
        .from("vendedor_propostas")
        .select(`
          id,
          cliente_id,
          vendedor_id,
          valor_total,
          created_at
        `)
        .in("id", propostaIds);

      if (propostasError) {
        throw new Error(`Error fetching propostas: ${propostasError.message}`);
      }
    }

    const propostaMap = new Map(propostas?.map((p: any) => [p.id, p]) || []);

    // Get client names - first from propostas, but we'll expand later
    let clienteIds = [...new Set(propostas?.map((p: any) => p.cliente_id).filter(Boolean) || [])];
    
    // Also get cliente_ids from all Shopify orders (including #D*) for better matching
    const { data: allClienteIds, error: allClienteError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("cliente_id")
      .not("cliente_id", "is", null);

    if (!allClienteError && allClienteIds) {
      const shopifyClienteIds = allClienteIds.map((c: any) => c.cliente_id).filter(Boolean);
      clienteIds = [...new Set([...clienteIds, ...shopifyClienteIds])];
    }
    
    let clienteMap = new Map<string, string>();
    if (clienteIds.length > 0) {
      const { data: clientes, error: clientesError } = await supabase
        .from("ebd_clientes")
        .select("id, nome_igreja")
        .in("id", clienteIds);

      clienteMap = new Map(clientes?.map((c: any) => [c.id, c.nome_igreja]) || []);
    }

    // Get all Shopify orders for potential matching
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
      .not("order_number", "like", "#D%")
      .not("bling_order_id", "is", null);

    if (shopifyError) {
      throw new Error(`Error fetching Shopify orders: ${shopifyError.message}`);
    }

    console.log(`Found ${allShopifyOrders?.length || 0} real Shopify orders with bling_order_id`);

    // Group Shopify orders by cliente_id
    const ordersByCliente = new Map<string, any[]>();
    for (const order of allShopifyOrders || []) {
      if (!order.cliente_id) continue;
      if (!ordersByCliente.has(order.cliente_id)) {
        ordersByCliente.set(order.cliente_id, []);
      }
      ordersByCliente.get(order.cliente_id)!.push(order);
    }

    // Get all digital proposals (#D*) to extract cliente_id when proposta is null
    const { data: digitalProposals, error: digitalError } = await supabase
      .from("ebd_shopify_pedidos")
      .select("id, cliente_id, order_number, valor_total, order_date")
      .like("order_number", "#D%");

    if (digitalError) {
      console.error("Error fetching digital proposals:", digitalError.message);
    }

    const digitalProposalMap = new Map(
      digitalProposals?.map((dp: any) => [dp.id, dp]) || []
    );

    // Process each parcela
    for (const parcela of parcelasLiberadas || []) {
      const proposta = propostaMap.get(parcela.proposta_id);
      let clienteId = proposta?.cliente_id;
      let clienteNome: string | null = clienteId ? (clienteMap.get(clienteId) || null) : null;
      const valorParcela = parcela.valor || 0;
      let dataReferencia = proposta?.created_at || parcela.created_at;

      // If no proposta, try to get cliente_id from the linked digital proposal
      if (!clienteId && parcela.shopify_pedido_id) {
        const digitalProposal = digitalProposalMap.get(parcela.shopify_pedido_id);
        if (digitalProposal) {
          clienteId = digitalProposal.cliente_id;
          clienteNome = clienteId ? (clienteMap.get(clienteId) || null) : null;
          dataReferencia = digitalProposal.order_date || parcela.created_at;
        }
      }

      // Check if already has valid shopify_pedido_id pointing to real order (not #D*)
      if (parcela.shopify_pedido_id) {
        const existingOrder = allShopifyOrders?.find((o: any) => o.id === parcela.shopify_pedido_id);
        if (existingOrder && existingOrder.bling_order_id) {
          // Already linked to a real order, skip revinculação but continue to DANFE check
          continue;
        }
      }

      // Validate cliente_id
      if (!clienteId) {
        notFound.push({
          parcela_id: parcela.id,
          proposta_id: parcela.proposta_id,
          motivo: "missing_cliente_id",
          cliente_id: null,
          cliente_nome: null,
          valor_parcela: valorParcela,
          data_referencia: dataReferencia,
          candidatos_tentados: [],
        });
        continue;
      }

      // Get orders for this client
      const clientOrders = ordersByCliente.get(clienteId) || [];

      if (clientOrders.length === 0) {
        notFound.push({
          parcela_id: parcela.id,
          proposta_id: parcela.proposta_id,
          motivo: "no_shopify_orders",
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          valor_parcela: valorParcela,
          data_referencia: dataReferencia,
          candidatos_tentados: [],
        });
        continue;
      }

      // Try to match orders
      const candidatos: CandidatoTentado[] = [];
      const matches: CandidatoTentado[] = [];
      const refDate = dataReferencia ? new Date(dataReferencia) : null;

      for (const order of clientOrders) {
        const diffValor = Math.abs(valorParcela - (order.valor_total || 0));
        const orderDate = order.order_date ? new Date(order.order_date) : null;
        const diffDias = refDate && orderDate
          ? Math.abs(Math.round((refDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)))
          : 999;

        let motivoRejeicao: string | null = null;

        if (diffValor > params.tolerance_value) {
          motivoRejeicao = `diff_valor (${diffValor.toFixed(2)}) > tolerance (${params.tolerance_value})`;
        } else if (diffDias > params.tolerance_days) {
          motivoRejeicao = `diff_dias (${diffDias}) > tolerance (${params.tolerance_days})`;
        }

        const candidato: CandidatoTentado = {
          order_number: order.order_number,
          pedido_id: order.id,
          valor_total: order.valor_total || 0,
          diff_valor: diffValor,
          order_date: order.order_date || "",
          diff_dias: diffDias,
          motivo_rejeicao: motivoRejeicao,
        };

        candidatos.push(candidato);

        if (!motivoRejeicao) {
          matches.push(candidato);
        }
      }

      if (matches.length === 0) {
        // Determine most specific reason
        const hasValueMatch = candidatos.some((c) => Math.abs(valorParcela - c.valor_total) <= params.tolerance_value);
        const motivo = hasValueMatch ? "no_matching_date" : "no_matching_value";

        notFound.push({
          parcela_id: parcela.id,
          proposta_id: parcela.proposta_id,
          motivo,
          cliente_id: clienteId,
          cliente_nome: clienteNome,
          valor_parcela: valorParcela,
          data_referencia: dataReferencia,
          candidatos_tentados: candidatos,
        });
      } else if (matches.length === 1) {
        // Unique match - vincular
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
          diff_dias: match.diff_dias,
        });
      } else {
        // Multiple matches - ambiguous
        // Sort by diff_dias, then diff_valor
        matches.sort((a, b) => {
          if (a.diff_dias !== b.diff_dias) return a.diff_dias - b.diff_dias;
          return a.diff_valor - b.diff_valor;
        });

        ambiguous.push({
          parcela_id: parcela.id,
          proposta_id: parcela.proposta_id,
          motivo: `${matches.length} pedidos com match`,
          cliente_id: clienteId,
          cliente_nome: clienteNome || "",
          valor_parcela: valorParcela,
          candidatos: matches,
        });
      }
    }

    console.log(`Vinculados: ${vinculados.length}, Ambiguous: ${ambiguous.length}, Not Found: ${notFound.length}`);

    // ============================================
    // ETAPA 2: Buscar NF-e do Bling
    // ============================================
    console.log("\n=== ETAPA 2: Buscar NF-e do Bling ===");

    // Get all Shopify orders that need NF-e update
    const { data: ordersNeedingNfe, error: ordersNfeError } = await supabase
      .from("ebd_shopify_pedidos")
      .select(`
        id,
        order_number,
        bling_order_id,
        nota_fiscal_url,
        nota_fiscal_numero
      `)
      .not("bling_order_id", "is", null);

    if (ordersNfeError) {
      throw new Error(`Error fetching orders for NF-e: ${ordersNfeError.message}`);
    }

    console.log(`Processing ${ordersNeedingNfe?.length || 0} orders with bling_order_id`);

    let nfesBuscadas = 0;
    let nfesEncontradas = 0;

    for (const order of ordersNeedingNfe || []) {
      // Always fetch fresh data from Bling
      try {
        nfesBuscadas++;
        
        // Small delay to avoid rate limiting
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
              hasNotaFiscal: !!orderDetail.notaFiscal,
              hasNfe: !!orderDetail.nfe,
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
            payload_resumido: { nfeId },
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
        const nfNumero = nfeDetail.numero?.toString();

        if (!linkDanfe) {
          nfeErrors.push({
            bling_order_id: order.bling_order_id,
            order_number: order.order_number,
            motivo: "linkDanfe_missing",
          });
          continue;
        }

        nfesEncontradas++;

        // Update ebd_shopify_pedidos
        if (!params.dry_run) {
          await supabase
            .from("ebd_shopify_pedidos")
            .update({
              nota_fiscal_url: linkDanfe,
              nota_fiscal_numero: nfNumero,
            })
            .eq("id", order.id);
        }

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

    // ============================================
    // ETAPA 3: Propagar DANFE para Parcelas
    // ============================================
    console.log("\n=== ETAPA 3: Propagar DANFE para Parcelas ===");

    // Get updated Shopify orders with NF-e
    const { data: ordersWithNfe, error: ordersWithNfeError } = await supabase
      .from("ebd_shopify_pedidos")
      .select(`
        id,
        order_number,
        nota_fiscal_url,
        nota_fiscal_numero
      `)
      .not("nota_fiscal_url", "is", null);

    if (ordersWithNfeError) {
      throw new Error(`Error fetching orders with NF-e: ${ordersWithNfeError.message}`);
    }

    const orderNfeMap = new Map(
      ordersWithNfe?.map((o: any) => [o.id, { url: o.nota_fiscal_url, numero: o.nota_fiscal_numero, orderNumber: o.order_number }]) || []
    );

    // Get all parcelas that could benefit from propagation
    const { data: parcelasToPropagateCheck, error: propagateCheckError } = await supabase
      .from("vendedor_propostas_parcelas")
      .select(`
        id,
        shopify_pedido_id,
        link_danfe
      `)
      .eq("comissao_status", "liberada")
      .is("link_danfe", null)
      .not("shopify_pedido_id", "is", null);

    if (propagateCheckError) {
      throw new Error(`Error fetching parcelas for propagation: ${propagateCheckError.message}`);
    }

    for (const parcela of parcelasToPropagateCheck || []) {
      const nfeInfo = orderNfeMap.get(parcela.shopify_pedido_id);
      
      if (nfeInfo && nfeInfo.url) {
        if (!params.dry_run) {
          await supabase
            .from("vendedor_propostas_parcelas")
            .update({
              link_danfe: nfeInfo.url,
              nota_fiscal_numero: nfeInfo.numero,
            })
            .eq("id", parcela.id);
        }

        danfesPropagados.push({
          parcela_id: parcela.id,
          pedido_id: parcela.shopify_pedido_id,
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
      summary: {
        parcelas_processadas: parcelasLiberadas?.length || 0,
        vinculos_criados: vinculados.length,
        nfes_buscadas_bling: nfesBuscadas,
        nfes_encontradas: nfesEncontradas,
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
