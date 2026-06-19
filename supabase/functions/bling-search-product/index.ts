import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('Renovando token do Bling...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
  const tokenResponse = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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
    console.error('Erro ao renovar token:', tokenData);
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
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log('Token renovado com sucesso! Expira em:', expiresAt.toISOString());
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;

  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Remove HTML tags from string
function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

// Delay utility for rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch product details from Bling
async function fetchProductDetails(accessToken: string, productId: number): Promise<any | null> {
  const url = `https://api.bling.com.br/Api/v3/produtos/${productId}`;
  console.log(`Buscando detalhes do produto: ${url}`);

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    console.warn(`Falha ao buscar detalhes do produto ${productId}:`, resp.status);
    return null;
  }

  const json = await resp.json();
  return json?.data ?? json;
}

// Detect if query looks like a SKU/code: no spaces, only code-safe chars,
// and either contains a digit OR a hyphen/underscore/dot/slash (typical SKU separators).
function looksLikeCode(query: string): boolean {
  const q = query.trim();
  if (q.includes(' ')) return false;
  if (!/^[A-Za-z0-9._\-\/]+$/.test(q)) return false;
  return /[0-9]/.test(q) || /[-_.\/]/.test(q);
}

async function fetchBling(url: string, accessToken: string): Promise<any[]> {
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) {
    console.warn(`Bling search failed (${resp.status}) for ${url}`);
    return [];
  }
  const json = await resp.json();
  return json?.data ?? [];
}

// Search products in Bling - supports SKU (numeric & alphanumeric like DG31788) and name.
// Includes inactive/all statuses (criterio=5) so digital products (revistas, livros) appear.
async function searchProducts(accessToken: string, query: string): Promise<any[]> {
  const trimmedQuery = query.trim();
  const encodedQuery = encodeURIComponent(trimmedQuery);
  const base = 'https://api.bling.com.br/Api/v3/produtos';
  // criterio=5 -> todas as situações (ativos, inativos, etc.)
  const allStatuses = '&criterio=5';

  // 1) If looks like a code/SKU, try by codigo (active + all-statuses)
  if (looksLikeCode(trimmedQuery)) {
    let results = await fetchBling(`${base}?codigo=${encodedQuery}&limite=10`, accessToken);
    if (results.length > 0) {
      console.log(`Encontrados ${results.length} por codigo (ativos)`);
      return results;
    }
    results = await fetchBling(`${base}?codigo=${encodedQuery}&limite=10${allStatuses}`, accessToken);
    if (results.length > 0) {
      console.log(`Encontrados ${results.length} por codigo (todas situações)`);
      return results;
    }
    console.log('Nenhum por codigo, tentando pesquisa...');
  }

  // 2) Broad text search (name + code + description) - active
  let results = await fetchBling(`${base}?pesquisa=${encodedQuery}&limite=10`, accessToken);
  if (results.length > 0) {
    console.log(`Encontrados ${results.length} por pesquisa (ativos)`);
    return results;
  }

  // 3) Broad text search - all statuses (includes digitais inativos)
  results = await fetchBling(`${base}?pesquisa=${encodedQuery}&limite=10${allStatuses}`, accessToken);
  if (results.length > 0) {
    console.log(`Encontrados ${results.length} por pesquisa (todas situações)`);
    return results;
  }

  // 4) Fallback: search by name (all statuses)
  results = await fetchBling(`${base}?nome=${encodedQuery}&limite=10${allStatuses}`, accessToken);
  if (results.length > 0) {
    console.log(`Encontrados ${results.length} por nome (todas situações)`);
  }
  return results;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Termo de busca deve ter pelo menos 2 caracteres',
        products: []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Buscando produtos no Bling com termo: "${query}"`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar configuração do Bling
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !blingConfig) {
      throw new Error('Configuração do Bling não encontrada');
    }

    // Verificar se o token está expirado e renovar se necessário
    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Buscar produtos
    let products = await searchProducts(accessToken, query.trim());

    // Se erro de autenticação, renovar e tentar novamente
    if (products.length === 0) {
      // Tentar com token renovado
      accessToken = await refreshBlingToken(supabase, blingConfig);
      products = await searchProducts(accessToken, query.trim());
    }

    if (products.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        products: [],
        message: 'Nenhum produto encontrado'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar detalhes de cada produto (com rate limiting)
    const detailedProducts = [];
    for (const product of products.slice(0, 10)) {
      await delay(350); // 350ms entre chamadas (Bling permite 3 req/s)
      
      const details = await fetchProductDetails(accessToken, Number(product.id));
      
      if (details) {
        // Bling v3 retorna imagens em vários caminhos diferentes dependendo
        // do produto. Tentamos todos os fallbacks conhecidos.
        const imagemURL =
          details.imagemURL ||
          details.imagem?.link ||
          details.midia?.imagens?.externas?.[0]?.link ||
          details.midia?.imagens?.internas?.[0]?.link ||
          details.anexos?.[0]?.url ||
          '';

        detailedProducts.push({
          id: details.id,
          codigo: details.codigo || '',
          nome: details.nome || '',
          preco: details.preco || 0,
          imagemURL,
          descricao: stripHtmlTags(details.descricaoCurta || details.descricao || ''),
          estoque: details.estoque?.saldoVirtualTotal ?? details.estoqueAtual ?? 0,
          tipo: details.tipo || 'P',
        });
      }
    }

    console.log(`Encontrados ${detailedProducts.length} produtos com detalhes`);

    return new Response(JSON.stringify({
      success: true,
      products: detailedProducts,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na busca de produtos:', error);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      products: []
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
