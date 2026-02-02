import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  return new Date() >= new Date(tokenExpiresAt);
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResp = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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

  if (!tokenResp.ok) throw new Error('Falha ao renovar token do Bling');

  const tokenData = await tokenResp.json();
  const expiresIn = tokenData.expires_in || 21600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  return tokenData.access_token;
}

async function fetchWithRetry(url: string, headers: any, maxRetries = 4): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, { headers });
      
      if (response.status === 429) {
        const waitTime = 2000 * (attempt + 1);
        await delay(waitTime);
        continue;
      }
      
      if (!response.ok) {
        if (response.status >= 500 && attempt < maxRetries - 1) {
          await delay(1500);
          continue;
        }
        return null;
      }
      
      return response.json();
    } catch (err) {
      if (attempt < maxRetries - 1) {
        await delay(1500);
        continue;
      }
      return null;
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sku, data_inicial, data_final, chunk_start = 0, chunk_size = 60 } = await req.json();

    if (!sku || !data_inicial || !data_final) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: sku, data_inicial, data_final' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BLING-COUNT] SKU ${sku} | ${data_inicial} a ${data_final} | Chunk: ${chunk_start}+${chunk_size}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: blingConfig } = await supabase
      .from('bling_config')
      .select('*')
      .limit(1)
      .single();

    if (!blingConfig) throw new Error('Configuração Bling não encontrada');

    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };

    // Step 1: Fetch all NFe IDs (quick - just the list)
    let allNfes: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const nfeUrl = `https://api.bling.com.br/Api/v3/nfe?dataEmissaoInicial=${data_inicial}&dataEmissaoFinal=${data_final}&situacao=6&limite=100&pagina=${page}`;
      
      await delay(500);
      const nfeData = await fetchWithRetry(nfeUrl, headers);
      
      const nfes = nfeData?.data || [];
      allNfes.push(...nfes);
      
      hasMore = nfes.length >= 100;
      page++;
    }

    const totalNfes = allNfes.length;
    console.log(`[BLING-COUNT] Total NF-e: ${totalNfes}. Processando chunk ${chunk_start} a ${chunk_start + chunk_size}...`);

    // Step 2: Process only this chunk
    const chunkEnd = Math.min(chunk_start + chunk_size, totalNfes);
    const nfesToProcess = allNfes.slice(chunk_start, chunkEnd);
    
    const allDetails: any[] = [];
    let produtoNome = '';

    for (const nfe of nfesToProcess) {
      await delay(500);
      
      const detailUrl = `https://api.bling.com.br/Api/v3/nfe/${nfe.id}`;
      const nfeDetail = await fetchWithRetry(detailUrl, headers);
      
      if (!nfeDetail?.data) continue;
      
      const itens = nfeDetail.data.itens || [];
      
      for (const item of itens) {
        const itemCodigo = String(item.codigo || item.produto?.codigo || '');
        
        if (itemCodigo === sku) {
          const quantidade = Number(item.quantidade) || 0;
          
          if (!produtoNome) {
            produtoNome = item.descricao || item.produto?.nome || '';
          }
          
          allDetails.push({
            nfe_id: nfe.id,
            nfe_numero: nfeDetail.data.numero,
            data: nfeDetail.data.dataEmissao,
            quantidade,
            valor_unitario: Number(item.valor) || 0,
            valor_total: (Number(item.valor) || 0) * quantidade,
          });
          
          console.log(`[BLING-COUNT] ✓ NF-e ${nfeDetail.data.numero}: ${quantidade} un`);
        }
      }
    }

    const totalQuantidade = allDetails.reduce((sum, d) => sum + d.quantidade, 0);
    const valorTotal = allDetails.reduce((sum, d) => sum + d.valor_total, 0);
    const hasMoreChunks = chunkEnd < totalNfes;

    console.log(`[BLING-COUNT] Chunk ${chunk_start}-${chunkEnd}: ${totalQuantidade} unidades em ${allDetails.length} notas`);

    return new Response(
      JSON.stringify({
        success: true,
        sku,
        produto_nome: produtoNome || `SKU ${sku}`,
        periodo: { de: data_inicial, ate: data_final },
        chunk_info: {
          start: chunk_start,
          end: chunkEnd,
          size: chunk_size,
          total_nfes: totalNfes,
          has_more: hasMoreChunks,
          next_start: hasMoreChunks ? chunkEnd : null,
        },
        chunk_resultado: {
          quantidade: totalQuantidade,
          notas: allDetails.length,
          valor: valorTotal,
        },
        detalhes: allDetails.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[BLING-COUNT] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
