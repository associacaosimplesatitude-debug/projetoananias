import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ===== Caches em memória (best-effort, vivem enquanto a função estiver "warm") =====
interface TokenCache {
  accessToken: string;
  expiresAt: number; // epoch ms
  configId: string;
}
let tokenCache: TokenCache | null = null;

interface SearchCacheEntry {
  ts: number;
  products: any[];
}
const searchCache = new Map<string, SearchCacheEntry>();
const SEARCH_TTL_MS = 60_000;

function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

// ===== Token =====
async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) throw new Error('Refresh token não disponível');

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

  const expiresInSec = tokenData.expires_in || 21600;
  const expiresAtDate = new Date();
  expiresAtDate.setSeconds(expiresAtDate.getSeconds() + expiresInSec);

  const { error: updateError } = await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAtDate.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error('Erro ao salvar tokens:', updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  tokenCache = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + expiresInSec * 1000 - 5 * 60_000,
    configId: config.id,
  };
  return tokenData.access_token;
}

async function getAccessToken(supabase: any): Promise<{ token: string; config: any }> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    // Ainda precisamos do config para um eventual refresh em caso de 401.
    // Buscamos lazy só quando necessário.
    return {
      token: tokenCache.accessToken,
      config: { id: tokenCache.configId, __lazy: true },
    };
  }

  const { data: blingConfig, error } = await supabase
    .from('bling_config')
    .select('*')
    .single();
  if (error || !blingConfig) throw new Error('Configuração do Bling não encontrada');

  const expiresAtMs = blingConfig.token_expires_at
    ? new Date(blingConfig.token_expires_at).getTime() - 5 * 60_000
    : 0;

  if (expiresAtMs > Date.now()) {
    tokenCache = {
      accessToken: blingConfig.access_token,
      expiresAt: expiresAtMs,
      configId: blingConfig.id,
    };
    return { token: blingConfig.access_token, config: blingConfig };
  }

  const token = await refreshBlingToken(supabase, blingConfig);
  return { token, config: blingConfig };
}

// ===== Busca =====
function looksLikeCode(query: string): boolean {
  const q = query.trim();
  if (q.includes(' ')) return false;
  if (!/^[A-Za-z0-9._\-\/]+$/.test(q)) return false;
  return /[0-9]/.test(q) || /[-_.\/]/.test(q);
}

interface FetchResult {
  ok: boolean;
  status: number;
  data: any[];
}

async function fetchBling(url: string, accessToken: string): Promise<FetchResult> {
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });
  if (!resp.ok) {
    // Consumir o body para evitar leak
    try { await resp.text(); } catch { /* ignore */ }
    return { ok: false, status: resp.status, data: [] };
  }
  const json = await resp.json();
  return { ok: true, status: 200, data: json?.data ?? [] };
}

function dedupeById(items: any[]): any[] {
  const seen = new Set<string | number>();
  const out: any[] = [];
  for (const it of items) {
    const id = it?.id;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

interface SearchOutcome {
  products: any[];
  unauthorized: boolean;
}

// Busca em paralelo (sem cascata sequencial). Mescla resultados deduplicando por id.
async function searchProducts(accessToken: string, query: string): Promise<SearchOutcome> {
  const q = query.trim();
  const encoded = encodeURIComponent(q);
  const base = 'https://api.bling.com.br/Api/v3/produtos';
  const allStatuses = '&criterio=5';

  const urls: string[] = [];
  if (looksLikeCode(q)) {
    urls.push(`${base}?codigo=${encoded}&limite=10`);
    urls.push(`${base}?codigo=${encoded}&limite=10${allStatuses}`);
  }
  if (q.includes(' ')) {
    urls.push(`${base}?nome=${encoded}&limite=10`);
    urls.push(`${base}?nome=${encoded}&limite=10${allStatuses}`);
  }
  // Pesquisa ampla sempre como rede de segurança
  urls.push(`${base}?pesquisa=${encoded}&limite=10${allStatuses}`);

  const results = await Promise.all(urls.map((u) => fetchBling(u, accessToken)));

  const unauthorized = results.some((r) => r.status === 401);
  const merged = dedupeById(results.flatMap((r) => r.data)).slice(0, 10);

  return { products: merged, unauthorized };
}

// Mapeia diretamente do retorno da busca (sem hit extra em /produtos/{id})
function mapBlingProduct(source: any) {
  const imagemURL =
    source.imagemURL ||
    source.imagem?.link ||
    source.midia?.imagens?.externas?.[0]?.link ||
    source.midia?.imagens?.internas?.[0]?.link ||
    source.anexos?.[0]?.url ||
    '';

  const estoque =
    (typeof source.estoque === 'object' && source.estoque
      ? (source.estoque.saldoVirtualTotal ?? source.estoque.saldoVirtual ?? 0)
      : null) ??
    source.estoqueAtual ??
    (typeof source.estoque === 'number' ? source.estoque : 0) ??
    0;

  return {
    id: source.id,
    codigo: source.codigo || '',
    nome: source.nome || '',
    preco: source.preco || 0,
    imagemURL,
    descricao: stripHtmlTags(source.descricaoCurta || source.descricao || ''),
    estoque,
    tipo: source.tipo || 'P',
    saldosPorDeposito: [] as Array<{ depositoId: number; nome: string; saldo: number }>,
  };
}

// Busca saldos por depósito para uma lista de produtos em UMA chamada.
// Retorna Map<produtoId, [{depositoId, nome, saldo}]>.
async function fetchSaldosPorDeposito(
  accessToken: string,
  productIds: Array<number | string>,
): Promise<Map<string, Array<{ depositoId: number; nome: string; saldo: number }>>> {
  const map = new Map<string, Array<{ depositoId: number; nome: string; saldo: number }>>();
  if (productIds.length === 0) return map;

  const params = productIds.map((id) => `idsProdutos[]=${encodeURIComponent(String(id))}`).join('&');
  const url = `https://api.bling.com.br/Api/v3/estoques/saldos?${params}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    });
    if (!resp.ok) return map;
    const json = await resp.json();
    const items = json?.data ?? [];
    for (const item of items) {
      const prodId = String(item?.produto?.id ?? '');
      if (!prodId) continue;
      const saldos: any[] = Array.isArray(item.saldos) ? item.saldos : [];
      const list = saldos
        .map((s) => ({
          depositoId: Number(s?.deposito?.id ?? 0),
          nome: String(s?.deposito?.descricao ?? s?.deposito?.nome ?? 'Depósito'),
          saldo: Number(s?.saldoFisico ?? s?.saldoFisicoTotal ?? 0) || 0,
        }))
        .filter((s) => s.depositoId > 0);
      map.set(prodId, list);
    }
  } catch (e) {
    console.warn('[fetchSaldosPorDeposito] erro:', e);
  }
  return map;
}

// Sincroniza a tabela public.bling_depositos_config com os depósitos vistos,
// para que o frontend consiga mapear nome -> CEP de origem sem intervenção manual.
async function syncDepositosConfig(
  supabase: any,
  saldosMap: Map<string, Array<{ depositoId: number; nome: string; saldo: number }>>,
) {
  const seen = new Map<number, string>();
  for (const list of saldosMap.values()) {
    for (const s of list) {
      if (s.depositoId > 0 && !seen.has(s.depositoId)) seen.set(s.depositoId, s.nome);
    }
  }
  if (seen.size === 0) return;
  try {
    const { data: existing } = await supabase
      .from('bling_depositos_config')
      .select('id, bling_deposito_id, nome');
    const existingById = new Map<number, any>();
    const existingByNome = new Map<string, any>();
    for (const row of existing ?? []) {
      existingById.set(Number(row.bling_deposito_id), row);
      existingByNome.set(String(row.nome).trim().toUpperCase(), row);
    }
    for (const [id, nome] of seen.entries()) {
      if (existingById.has(id)) continue;
      // Tenta casar por nome (linhas seed com IDs negativos)
      const byName = existingByNome.get(nome.trim().toUpperCase());
      if (byName) {
        await supabase
          .from('bling_depositos_config')
          .update({ bling_deposito_id: id, nome })
          .eq('id', byName.id);
      } else {
        // Insere novo depósito com CEP da matriz como default
        await supabase.from('bling_depositos_config').insert({
          bling_deposito_id: id,
          nome,
          cep_origem: '22713-001',
          cidade: 'Rio de Janeiro',
          estado: 'RJ',
          ativo_pdv: true,
          ordem: 99,
        });
      }
    }
  } catch (e) {
    console.warn('[syncDepositosConfig] erro:', e);
  }
}

serve(async (req) => {
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

    const normalized = query.trim().toLowerCase();

    // Cache hit (60s)
    const cached = searchCache.get(normalized);
    if (cached && Date.now() - cached.ts < SEARCH_TTL_MS) {
      return new Response(JSON.stringify({
        success: true,
        products: cached.products,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let { token, config } = await getAccessToken(supabase);
    let outcome = await searchProducts(token, query.trim());

    // Só renova token em caso de 401 explícito (não em "0 resultados").
    if (outcome.unauthorized) {
      if (config?.__lazy) {
        const { data: full } = await supabase.from('bling_config').select('*').single();
        if (full) config = full;
      }
      token = await refreshBlingToken(supabase, config);
      outcome = await searchProducts(token, query.trim());
    }

    const detailedProducts = outcome.products.map(mapBlingProduct);

    // Atualiza cache
    searchCache.set(normalized, { ts: Date.now(), products: detailedProducts });
    // Limita o tamanho do cache para não crescer indefinidamente
    if (searchCache.size > 200) {
      const firstKey = searchCache.keys().next().value;
      if (firstKey) searchCache.delete(firstKey);
    }

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
