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
  nfes_processed: number;
  books_found: number;
  summary: {
    total_quantidade: number;
    total_valor_vendas: number;
    total_royalties: number;
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function refreshBlingToken(supabase: any, config: BlingConfig, configId: string): Promise<string> {
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

  await supabase
    .from("bling_config")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", configId);

  console.log("[Bling] Token refreshed successfully");
  return tokenData.access_token;
}

function isTokenExpired(expiresAt: string): boolean {
  const expirationDate = new Date(expiresAt);
  const now = new Date();
  return now >= new Date(expirationDate.getTime() - 5 * 60 * 1000);
}

async function blingApiCall(accessToken: string, endpoint: string, retries = 3): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    await delay(400); // Slightly more conservative rate limiting
    
    const response = await fetch(`https://www.bling.com.br/Api/v3${endpoint}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    });

    if (response.status === 429) {
      console.log(`[Bling] Rate limited, attempt ${attempt}/${retries}, waiting...`);
      await delay(3000 * attempt);
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
      codigo_bling,
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
    
    const percentual = book.royalties_comissoes?.[0]?.percentual || 0;
    
    const mapping: BookMapping = {
      livro_id: book.id,
      bling_produto_id: book.bling_produto_id.toString(),
      percentual_comissao: percentual,
      preco_capa: book.valor_capa || 0,
    };
    
    // Map by bling_produto_id
    bookMap.set(book.bling_produto_id.toString(), mapping);
    
    // Also map by codigo_bling (SKU) - this is what NFe items use
    if (book.codigo_bling) {
      bookMap.set(book.codigo_bling, mapping);
      console.log(`[DB] Mapped codigo_bling: ${book.codigo_bling} -> livro ${book.id}`);
    }
  }

  console.log(`[DB] Loaded ${bookMap.size} book mappings`);
  return bookMap;
}

async function syncNFeBatch(
  supabase: any,
  accessToken: string,
  bookMap: Map<string, BookMapping>,
  dataInicial: string,
  dataFinal: string,
  maxNfes: number,
  skipNfes: number = 0
): Promise<SyncResult & { total_nfes_available: number }> {
  const result: SyncResult = {
    synced: 0,
    skipped: 0,
    errors: 0,
    nfes_processed: 0,
    books_found: 0,
    summary: {
      total_quantidade: 0,
      total_valor_vendas: 0,
      total_royalties: 0,
    },
  };

  console.log(`[Sync] Fetching NFes from ${dataInicial} to ${dataFinal} (max: ${maxNfes})...`);

  // Fetch all NFe pages
  let allAuthorizedNfes: any[] = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore && page <= 5) { // Max 5 pages = 500 NFes
    const endpoint = `/nfe?dataEmissaoInicial=${dataInicial}&dataEmissaoFinal=${dataFinal}&limite=100&pagina=${page}`;
    const response = await blingApiCall(accessToken, endpoint);
    const nfes = response.data || [];
    
    if (nfes.length === 0) {
      hasMore = false;
      break;
    }
    
    // Filter authorized only (situacao = 6)
    const authorizedNfes = nfes.filter((nfe: any) => {
      const sitValue = typeof nfe.situacao === 'object' ? nfe.situacao?.valor || nfe.situacao?.id : nfe.situacao;
      return sitValue === 6;
    });
    
    allAuthorizedNfes = allAuthorizedNfes.concat(authorizedNfes);
    console.log(`[Bling] Page ${page}: ${authorizedNfes.length} authorized of ${nfes.length} total`);
    
    if (nfes.length < 100) {
      hasMore = false;
    }
    page++;
  }
  
  console.log(`[Bling] Total: ${allAuthorizedNfes.length} NFes autorizadas`);

  const totalAvailable = allAuthorizedNfes.length;

  // Skip and limit NFes to process
  const nfesToProcess = allAuthorizedNfes.slice(skipNfes, skipNfes + maxNfes);
  const processedItems: any[] = [];
  
  console.log(`[Sync] Processing NFes ${skipNfes} to ${skipNfes + nfesToProcess.length} of ${totalAvailable}`);

  for (const nfe of nfesToProcess) {
    result.nfes_processed++;

    try {
      // Fetch NFe details
      const nfeDetails = await blingApiCall(accessToken, `/nfe/${nfe.id}`);
      const nfeData = nfeDetails.data;
      
      if (!nfeData?.itens || nfeData.itens.length === 0) {
        result.skipped++;
        continue;
      }

      // Process items
      for (const item of nfeData.itens) {
        const produtoId = item.produto?.id?.toString();
        const codigo = item.codigo || item.produto?.codigo;
        
        let bookInfo = produtoId ? bookMap.get(produtoId) : null;
        if (!bookInfo && codigo) {
          bookInfo = bookMap.get(codigo);
        }

        if (!bookInfo) continue;

        result.books_found++;
        const quantidade = item.quantidade || 1;
        const valorUnitario = item.valor || item.valorUnidade || bookInfo.preco_capa;
        const valorComissaoUnitario = valorUnitario * (bookInfo.percentual_comissao / 100);
        const valorComissaoTotal = valorComissaoUnitario * quantidade;

        processedItems.push({
          livro_id: bookInfo.livro_id,
          quantidade,
          valor_unitario: valorUnitario,
          valor_comissao_unitario: valorComissaoUnitario,
          valor_comissao_total: valorComissaoTotal,
          data_venda: nfeData.dataEmissao?.split(" ")[0] || new Date().toISOString().split("T")[0],
          bling_order_id: nfeData.id,
          bling_order_number: nfeData.numero?.toString() || null,
        });

        result.summary.total_quantidade += quantidade;
        result.summary.total_valor_vendas += valorUnitario * quantidade;
        result.summary.total_royalties += valorComissaoTotal;
        
        console.log(`[Match] NFe ${nfe.id}: ${quantidade}x livro ${bookInfo.livro_id}`);
      }

      result.synced++;
    } catch (error) {
      console.error(`[Sync] Error processing NFe ${nfe.id}:`, error);
      result.errors++;
    }
  }

  // Insert new records
  if (processedItems.length > 0) {
    console.log(`[DB] Processing ${processedItems.length} sales records...`);
    
    const existingKeys = new Set<string>();
    const blingOrderIds = [...new Set(processedItems.map(o => o.bling_order_id))];
    
    const { data: existingRecords } = await supabase
      .from("royalties_vendas")
      .select("bling_order_id, livro_id")
      .in("bling_order_id", blingOrderIds);
    
    for (const record of existingRecords || []) {
      existingKeys.add(`${record.bling_order_id}-${record.livro_id}`);
    }
    
    const newRecords = processedItems.filter(item => {
      const key = `${item.bling_order_id}-${item.livro_id}`;
      return !existingKeys.has(key);
    });
    
    console.log(`[DB] ${newRecords.length} new records (${processedItems.length - newRecords.length} already exist)`);
    
    if (newRecords.length > 0) {
      const { error } = await supabase.from("royalties_vendas").insert(newRecords);
      if (error) {
        console.error("[DB] Insert error:", error);
        result.errors += newRecords.length;
      }
    }
  }

  console.log(`[Sync] Complete: ${result.nfes_processed} NFes, ${result.books_found} books found, ${result.errors} errors`);
  return { ...result, total_nfes_available: totalAvailable };
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

    let daysBack = 30;
    let maxNfes = 30;
    let skipNfes = 0;
    
    try {
      const body = await req.json();
      daysBack = body.days_back || 30;
      maxNfes = body.max_nfes || 30;
      skipNfes = body.skip || 0;
    } catch {
      // Use defaults
    }

    console.log(`[Start] Syncing NFes from last ${daysBack} days (skip: ${skipNfes}, max: ${maxNfes})`);

    // Get Bling config
    const { data: configData, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !configData) {
      return new Response(
        JSON.stringify({ error: "Bling not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = configData as BlingConfig;

    // Check/refresh token
    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, config, configData.id);
    }

    // Load books
    const bookMap = await loadBooksWithBlingId(supabase);
    
    if (bookMap.size === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum livro com bling_produto_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate date range
    const dataFinal = new Date();
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - daysBack);
    
    const dataInicialStr = dataInicial.toISOString().split("T")[0];
    const dataFinalStr = dataFinal.toISOString().split("T")[0];

    // Sync batch
    const result = await syncNFeBatch(supabase, accessToken, bookMap, dataInicialStr, dataFinalStr, maxNfes, skipNfes);

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
