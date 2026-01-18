import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID da loja Shopify no Bling (E-COMMERCE channel)
const SHOPIFY_LOJA_ID_BLING = 205391854;

// Rate limit do Bling: 3 req/s. Vamos garantir no máximo ~2.8 req/s.
const MIN_BLING_CALL_INTERVAL_MS = 350;
let lastBlingCallAt = 0;

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[${tableName}] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
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
    console.error(`[${tableName}] Erro ao renovar token:`, tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from(tableName)
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  if (updateError) {
    console.error(`[${tableName}] Erro ao salvar tokens:`, updateError);
    throw new Error('Erro ao salvar tokens renovados');
  }

  console.log(`[${tableName}] Token renovado com sucesso!`);
  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Função para fazer chamada à API do Bling com retry (401/429) + rate limit
async function blingApiCall(
  url: string,
  accessToken: string,
  supabase: any,
  config: any
): Promise<{ data: any; newToken?: string }> {
  let token = accessToken;

  const maxAttempts = 6;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // Rate limiter global
    const now = Date.now();
    const delta = now - lastBlingCallAt;
    if (delta < MIN_BLING_CALL_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, MIN_BLING_CALL_INTERVAL_MS - delta));
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    lastBlingCallAt = Date.now();

    // Se der 401, tentar renovar token e fazer nova chamada
    if (response.status === 401) {
      console.log('Token inválido (401), renovando...');
      token = await refreshBlingToken(supabase, config, 'bling_config', config.client_id, config.client_secret);
      continue;
    }

    // Se der 429, respeitar rate limit do Bling com backoff agressivo
    if (response.status === 429) {
      const waitMs = Math.min(8000, 1500 * attempt);
      const errorText = await response.text();
      console.warn(`Bling rate limit (429). Tentativa ${attempt}/${maxAttempts}. Aguardando ${waitMs}ms. Body: ${errorText}`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro Bling API:', response.status, errorText);
      throw new Error(`Erro Bling API: ${response.status}`);
    }

    const data = await response.json();
    return { data, newToken: token !== accessToken ? token : undefined };
  }

  throw new Error('Erro Bling API: 429');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { customer_email, limit } = await req.json();

    if (!customer_email) {
      return new Response(
        JSON.stringify({ error: "customer_email é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const desiredLimit = Math.max(1, Math.min(50, Number(limit) || 10));

    console.log('Buscando pedidos no Bling para email:', customer_email);
    const emailLower = customer_email.toLowerCase().trim();

    // Buscar configuração do Bling
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar config Bling:', configError);
      return new Response(
        JSON.stringify({ error: 'Configuração do Bling não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let accessToken = config.access_token;

    // Verificar se o token está expirado
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado, renovando...');
      accessToken = await refreshBlingToken(supabase, config, 'bling_config', config.client_id, config.client_secret);
    }

    // 1) Buscar o contato pelo email no Bling (para pegar o idContato)
    const contatoUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(emailLower)}&limite=1`;
    console.log('Buscando contato no Bling:', contatoUrl);

    const contatoResult = await blingApiCall(contatoUrl, accessToken, supabase, config);
    if (contatoResult.newToken) accessToken = contatoResult.newToken;

    const contato = contatoResult.data?.data?.[0];
    const contatoId = contato?.id as number | undefined;

    if (!contatoId) {
      console.log(`Nenhum contato encontrado no Bling para o email ${emailLower}`);
      return new Response(
        JSON.stringify({ success: true, orders: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Buscar pedidos de venda filtrando por idContato (TODAS as lojas, não apenas Shopify)
    const filteredOrderIds: number[] = [];
    const limite = 100;
    const maxPaginas = 10; // segurança

    for (let pagina = 1; pagina <= maxPaginas; pagina++) {
      // Buscar TODOS os pedidos do contato, sem filtrar por loja
      const pedidosUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?idContato=${contatoId}&pagina=${pagina}&limite=${limite}`;
      console.log('Buscando pedidos no Bling:', pedidosUrl);

      const pedidosResult = await blingApiCall(pedidosUrl, accessToken, supabase, config);
      if (pedidosResult.newToken) accessToken = pedidosResult.newToken;

      const pedidosPagina = pedidosResult.data?.data || [];
      console.log(`Página ${pagina}: ${pedidosPagina.length} pedido(s)`);

      for (const p of pedidosPagina) {
        if (p?.id) filteredOrderIds.push(p.id);
        if (filteredOrderIds.length >= desiredLimit) break;
      }

      if (filteredOrderIds.length >= desiredLimit) break;
      if (pedidosPagina.length < limite) break; // última página
    }

    console.log(`Pedidos encontrados para contato ${contatoId} (${emailLower}): ${filteredOrderIds.length}`);

    if (filteredOrderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, orders: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache de situações
    const situacoesCache = new Map<number, string>();
    const situacoesPadrao: Record<number, string> = {
      28: 'Em aberto',
      31: 'Atendido',
      34: 'Cancelado',
      37: 'Em andamento',
    };
    for (const [id, nome] of Object.entries(situacoesPadrao)) {
      situacoesCache.set(Number(id), nome);
    }

    async function getSituacaoNome(situacaoId: number): Promise<string | null> {
      if (situacoesCache.has(situacaoId)) {
        return situacoesCache.get(situacaoId)!;
      }
      try {
        const sitUrl = `https://www.bling.com.br/Api/v3/situacoes/${situacaoId}`;
        const sitResult = await blingApiCall(sitUrl, accessToken, supabase, config);
        if (sitResult.newToken) accessToken = sitResult.newToken;
        
        const sitData = sitResult.data?.data;
        if (sitData?.nome) {
          situacoesCache.set(situacaoId, sitData.nome);
          return sitData.nome;
        }
      } catch (e) {
        console.warn(`Não foi possível buscar situação ${situacaoId}`);
      }
      return null;
    }

    // Buscar detalhes de cada pedido
    const ordersDetails = [];

    for (const orderId of filteredOrderIds.slice(0, desiredLimit)) {
      try {
        // Buscar detalhes do pedido
        const detailUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
        const detailResult = await blingApiCall(detailUrl, accessToken, supabase, config);
        if (detailResult.newToken) accessToken = detailResult.newToken;

        const order = detailResult.data?.data;
        if (!order) continue;

        // Extrair situação
        const situacao = order.situacao || {};
        const situacaoId = situacao.id || null;
        let situacaoNome = situacao.valor || situacao.nome || null;
        if (!situacaoNome && situacaoId) {
          situacaoNome = await getSituacaoNome(situacaoId);
        }

        // Extrair transporte e rastreio
        const transporte = order.transporte || {};
        const volumes = transporte.volumes || [];
        let codigoRastreio = null;
        for (const volume of volumes) {
          if (volume.codigoRastreamento) {
            codigoRastreio = volume.codigoRastreamento;
            break;
          }
        }

        // Extrair itens
        const itens = (order.itens || []).map((item: any) => ({
          codigo: item.codigo || '',
          descricao: item.descricao || 'Produto',
          quantidade: item.quantidade || 1,
          valor: item.valor || 0,
        }));

        // NF-e (desativado aqui para evitar rate limit do Bling)
        // Se precisar reativar, implementar cache + throttling e/ou buscar NF-e sob demanda.
        const nfe = null;

        // Montar objeto do pedido
        ordersDetails.push({
          id: order.id,
          numero: order.numeroLoja || order.numero || String(order.id),
          data: order.data || new Date().toISOString(),
          situacao: {
            id: situacaoId,
            nome: situacaoNome || 'Processando',
          },
          contato: {
            nome: order.contato?.nome || 'Cliente',
            email: order.contato?.email || '',
          },
          itens,
          valor_total: order.total || 0,
          valor_frete: order.transporte?.frete || 0,
          transporte: {
            codigo_rastreio: codigoRastreio,
          },
          nfe,
        });

        // Throttle para respeitar rate limit do Bling
        await new Promise((r) => setTimeout(r, 350));

      } catch (err) {
        console.error(`Erro ao processar pedido ${orderId}:`, err);
      }
    }

    // Ordenar por data (mais recentes primeiro)
    ordersDetails.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    console.log(`Retornando ${ordersDetails.length} pedidos para ${emailLower}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        orders: ordersDetails,
        total: ordersDetails.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
