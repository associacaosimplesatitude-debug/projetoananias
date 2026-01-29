import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BlingConfig {
  access_token: string;
  refresh_token: string;
  token_expires_at: string;
  client_id: string;
  client_secret: string;
}

interface BookMapping {
  livro_id: string;
  bling_produto_id: string;
  percentual_comissao: number;
  preco_capa: number;
}

interface SyncResult {
  synced: number;
  skipped: number;
  errors: number;
  summary: {
    total_quantidade: number;
    total_valor_vendas: number;
    total_royalties: number;
  };
}

// Rate limiting: 350ms between calls (3 req/s limit)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshBlingToken(supabase: any, config: BlingConfig): Promise<string> {
  console.log("[Bling] Refreshing access token...");
  
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
    console.error("[Bling] Token refresh failed:", errorText);
    throw new Error(`Failed to refresh token: ${response.status}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  // Update token in database (use the first config row)
  const { data: configs } = await supabase
    .from("bling_config")
    .select("id")
    .limit(1)
    .single();

  if (configs?.id) {
    await supabase
      .from("bling_config")
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", configs.id);
  }

  console.log("[Bling] Token refreshed successfully");
  return tokenData.access_token;
}

function isTokenExpired(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  // Add 5 minute buffer
  return now >= new Date(expirationDate.getTime() - 5 * 60 * 1000);
}

async function blingApiCall(
  accessToken: string,
  endpoint: string,
  retries = 3
): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await delay(350); // Rate limiting
    
    const response = await fetch(`https://www.bling.com.br/Api/v3${endpoint}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (response.status === 429) {
      console.log(`[Bling] Rate limited, attempt ${attempt}/${retries}, waiting...`);
      await delay(2000 * attempt);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Bling] API error ${response.status}: ${errorText}`);
      throw new Error(`Bling API error: ${response.status}`);
    }

    return response.json();
  }

  throw new Error("Max retries exceeded for Bling API call");
}

async function loadBooksWithBlingId(supabase: any): Promise<Map<string, BookMapping>> {
  console.log("[DB] Loading books with bling_produto_id...");
  
  const { data: books, error } = await supabase
    .from("royalties_livros")
    .select(`
      id,
      bling_produto_id,
      valor_capa,
      royalties_comissoes (
        percentual
      )
    `)
    .not("bling_produto_id", "is", null);

  if (error) {
    console.error("[DB] Error loading books:", error);
    throw error;
  }

  const bookMap = new Map<string, BookMapping>();
  
  for (const book of books || []) {
    if (!book.bling_produto_id) continue;
    
    // Get the active commission percentage
    const percentual = book.royalties_comissoes?.[0]?.percentual || 0;
    
    bookMap.set(book.bling_produto_id.toString(), {
      livro_id: book.id,
      bling_produto_id: book.bling_produto_id,
      percentual_comissao: percentual,
      preco_capa: book.valor_capa || 0,
    });
  }

  console.log(`[DB] Loaded ${bookMap.size} books with Bling IDs`);
  return bookMap;
}

// Status that should NOT be considered (canceled, returned, etc.)
const EXCLUDED_STATUS_NAMES = ["cancelado", "devolvido", "estornado"];

function isOrderCompleted(situacaoId: number, situacaoNome: string): boolean {
  const nomeLC = (situacaoNome || "").toLowerCase();
  
  // Exclude canceled/returned orders
  if (EXCLUDED_STATUS_NAMES.some(excluded => nomeLC.includes(excluded))) {
    return false;
  }
  
  // Include orders with completed-like statuses
  // Status 6 = Em aberto (pular)
  // Status 12 = Pagamento pendente (pular)
  // Status 24 = Em andamento (pular, ainda não enviado)
  // Status 56675/56676/57811 = Prováveis status de enviado/entregue
  const completedIds = new Set([9, 31, 56675, 56676, 57811]);
  const completedNames = ["atendido", "enviado", "entregue", "concluído", "finalizado", "faturado"];
  
  if (completedIds.has(situacaoId)) {
    return true;
  }
  
  if (completedNames.some(name => nomeLC.includes(name))) {
    return true;
  }
  
  return false;
}

async function syncOrders(
  supabase: any,
  accessToken: string,
  bookMap: Map<string, BookMapping>,
  daysBack: number,
  dryRun: boolean
): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    summary: {
      total_quantidade: 0,
      total_valor_vendas: 0,
      total_royalties: 0,
    },
  };

  // Calculate date range
  const dataInicial = new Date();
  dataInicial.setDate(dataInicial.getDate() - daysBack);
  const dataInicialStr = dataInicial.toISOString().split("T")[0];

  console.log(`[Sync] Fetching orders from ${dataInicialStr}...`);

  // Fetch orders list with pagination
  let page = 1;
  let hasMore = true;
  const processedOrders: any[] = [];

  while (hasMore && page <= 10) { // Max 10 pages = 1000 orders
    const ordersResponse = await blingApiCall(
      accessToken,
      `/pedidos/vendas?dataInicial=${dataInicialStr}&limite=100&pagina=${page}`
    );

    const orders = ordersResponse.data || [];
    console.log(`[Sync] Page ${page}: ${orders.length} orders`);

    if (orders.length === 0) {
      hasMore = false;
      break;
    }

    // Process each order
    for (const order of orders) {
      // Check if status is a valid "completed" status
      const situacaoId = order.situacao?.id || order.situacao?.valor;
      const situacaoNome = order.situacao?.nome || "";
      const isCompleted = isOrderCompleted(situacaoId, situacaoNome);
      
      if (!isCompleted) {
        console.log(`[Sync] Skipping order ${order.id} - status: ${order.situacao?.nome || situacaoId}`);
        result.skipped++;
        continue;
      }

      // Fetch order details to get items
      try {
        const orderDetails = await blingApiCall(accessToken, `/pedidos/vendas/${order.id}`);
        const orderData = orderDetails.data;
        
        if (!orderData?.itens || orderData.itens.length === 0) {
          console.log(`[Sync] Order ${order.id} has no items`);
          result.skipped++;
          continue;
        }

        // Process items
        for (const item of orderData.itens) {
          // Try to match by product ID or code
          const productId = item.produto?.id?.toString() || item.codigo;
          const bookInfo = bookMap.get(productId) || 
                          bookMap.get(item.codigo);

          if (!bookInfo) {
            continue; // Not a tracked book
          }

          const quantidade = item.quantidade || 1;
          const valorUnitario = item.valor || item.valorUnidade || bookInfo.preco_capa;
          const valorComissaoUnitario = valorUnitario * (bookInfo.percentual_comissao / 100);
          const valorComissaoTotal = valorComissaoUnitario * quantidade;

          processedOrders.push({
            livro_id: bookInfo.livro_id,
            quantidade,
            valor_unitario: valorUnitario,
            valor_comissao_unitario: valorComissaoUnitario,
            valor_comissao_total: valorComissaoTotal,
            data_venda: orderData.data || new Date().toISOString().split("T")[0],
            bling_order_id: orderData.id,
            bling_order_number: orderData.numero?.toString() || null,
          });

          result.summary.total_quantidade += quantidade;
          result.summary.total_valor_vendas += valorUnitario * quantidade;
          result.summary.total_royalties += valorComissaoTotal;
        }

        result.synced++;
      } catch (error) {
        console.error(`[Sync] Error processing order ${order.id}:`, error);
        result.errors++;
      }
    }

    page++;
    if (orders.length < 100) {
      hasMore = false;
    }
  }

  // Insert records (checking for duplicates first)
  if (!dryRun && processedOrders.length > 0) {
    console.log(`[DB] Processing ${processedOrders.length} sales records...`);
    
    // Get existing bling_order_id + livro_id combinations to avoid duplicates
    const existingKeys = new Set<string>();
    const blingOrderIds = [...new Set(processedOrders.map(o => o.bling_order_id))];
    
    const { data: existingRecords } = await supabase
      .from("royalties_vendas")
      .select("bling_order_id, livro_id")
      .in("bling_order_id", blingOrderIds);
    
    for (const record of existingRecords || []) {
      existingKeys.add(`${record.bling_order_id}-${record.livro_id}`);
    }
    
    // Filter out existing records
    const newRecords = processedOrders.filter(order => {
      const key = `${order.bling_order_id}-${order.livro_id}`;
      return !existingKeys.has(key);
    });
    
    console.log(`[DB] ${newRecords.length} new records to insert (${processedOrders.length - newRecords.length} already exist)`);
    
    if (newRecords.length > 0) {
      // Process in batches
      const batchSize = 50;
      for (let i = 0; i < newRecords.length; i += batchSize) {
        const batch = newRecords.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from("royalties_vendas")
          .insert(batch);

        if (error) {
          console.error("[DB] Error inserting batch:", error);
          result.errors += batch.length;
        }
      }
    }
  }

  console.log(`[Sync] Complete: ${result.synced} orders synced, ${result.skipped} skipped, ${result.errors} errors`);
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body
    let daysBack = 90;
    let dryRun = false;
    
    try {
      const body = await req.json();
      daysBack = body.days_back || 90;
      dryRun = body.dry_run || false;
    } catch {
      // Use defaults
    }

    console.log(`[Start] Syncing sales from last ${daysBack} days (dry_run: ${dryRun})`);

    // Get Bling config (first row)
    const { data: configData, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !configData) {
      console.error("[Config] Error loading Bling config:", configError);
      return new Response(
        JSON.stringify({ error: "Bling not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configData as BlingConfig;

    // Check/refresh token
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Load books mapping
    const bookMap = await loadBooksWithBlingId(supabase);
    
    if (bookMap.size === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Nenhum livro cadastrado com bling_produto_id" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync orders
    const result = await syncOrders(supabase, accessToken, bookMap, daysBack, dryRun);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Error]", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
