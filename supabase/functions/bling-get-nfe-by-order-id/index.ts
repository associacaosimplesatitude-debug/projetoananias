import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Verifica se o token expirou
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000; // 5 min buffer
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

// Refresh do token do Bling
async function refreshBlingToken(
  supabase: any,
  config: any
): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log('[GET-NFE-BY-ORDER] Renovando token do Bling...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  
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
    console.error('[GET-NFE-BY-ORDER] Erro ao renovar token:', tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

  console.log('[GET-NFE-BY-ORDER] Token renovado com sucesso!');
  return tokenData.access_token;
}

// Função para fazer chamada à API do Bling com retry em caso de 401
async function blingApiCall(
  url: string,
  accessToken: string,
  supabase: any,
  config: any
): Promise<{ data: any; newToken?: string }> {
  let token = accessToken;
  
  let response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  // Se der 401, tentar renovar token e fazer nova chamada
  if (response.status === 401) {
    console.log('[GET-NFE-BY-ORDER] Token inválido, renovando...');
    token = await refreshBlingToken(supabase, config);
    
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[GET-NFE-BY-ORDER] Erro Bling API:', response.status, errorText);
    throw new Error(`Erro Bling API: ${response.status}`);
  }

  const data = await response.json();
  return { data, newToken: token !== accessToken ? token : undefined };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blingOrderId } = await req.json();

    if (!blingOrderId) {
      return new Response(
        JSON.stringify({ success: false, error: "blingOrderId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[GET-NFE-BY-ORDER] Buscando NF-e para pedido Bling ID: ${blingOrderId}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar config do Bling
    const { data: config, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !config) {
      throw new Error("Configuração Bling não encontrada");
    }

    let accessToken = config.access_token;

    // Verificar se precisa renovar token
    if (isTokenExpired(config.token_expires_at)) {
      console.log("[GET-NFE-BY-ORDER] Token expirado, renovando...");
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Buscar NF-e vinculada ao pedido
    const nfeUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${blingOrderId}`;
    console.log(`[GET-NFE-BY-ORDER] Buscando NF-e: ${nfeUrl}`);

    const nfeResult = await blingApiCall(nfeUrl, accessToken, supabase, config);
    if (nfeResult.newToken) accessToken = nfeResult.newToken;

    const nfes = nfeResult.data?.data || [];
    console.log(`[GET-NFE-BY-ORDER] ${nfes.length} NF-e(s) encontrada(s) para pedido ${blingOrderId}`);

    if (nfes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          found: false,
          message: "NF-e ainda não emitida para este pedido"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Iterar pelas NF-es para encontrar uma válida
    for (const nfeCandidate of nfes) {
      // Verificar se é autorizada
      const sitId = nfeCandidate?.situacao?.id || nfeCandidate?.situacao;
      const sitNome = String(nfeCandidate?.situacao?.nome || '').toLowerCase();
      const isAutorizada = sitId === 6 || sitId === '6' || sitNome.includes('autoriz');

      if (!isAutorizada) {
        console.log(`[GET-NFE-BY-ORDER] NF-e ${nfeCandidate.numero} não autorizada (${sitId}/${sitNome})`);
        continue;
      }

      // Buscar detalhes da NF-e
      if (!nfeCandidate.id) continue;

      try {
        const danfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeCandidate.id}`;
        const danfeResult = await blingApiCall(danfeUrl, accessToken, supabase, config);
        if (danfeResult.newToken) accessToken = danfeResult.newToken;

        const nfeDetail = danfeResult.data?.data;

        // Validar que pertence ao pedido correto
        const nfePedidoId = nfeDetail?.pedidoVenda?.id || nfeDetail?.idPedidoVenda || null;
        if (nfePedidoId && nfePedidoId !== blingOrderId) {
          console.log(`[GET-NFE-BY-ORDER] NF-e ${nfeCandidate.numero} pertence a outro pedido (${nfePedidoId})`);
          continue;
        }

        // Buscar link DANFE
        let nfeUrlFinal: string | null = null;
        let tipoLink: 'danfe' | 'espelho' | null = null;

        // Prioridade: linkDanfe > link > linkPdf
        if (nfeDetail?.linkDanfe) {
          nfeUrlFinal = nfeDetail.linkDanfe;
          tipoLink = 'danfe';
        } else if (nfeDetail?.link && nfeDetail.link.includes('doc.view.php')) {
          nfeUrlFinal = nfeDetail.link;
          tipoLink = 'danfe';
        } else if (nfeDetail?.linkPdf) {
          nfeUrlFinal = nfeDetail.linkPdf;
          tipoLink = 'danfe';
        }

        if (nfeUrlFinal) {
          console.log(`[GET-NFE-BY-ORDER] ✓ NF-e encontrada! Número: ${nfeCandidate.numero}, URL: ${nfeUrlFinal}`);
          
          return new Response(
            JSON.stringify({
              success: true,
              found: true,
              numero: String(nfeCandidate.numero || ''),
              chave: nfeCandidate.chaveAcesso || null,
              url: nfeUrlFinal,
              tipo_link: tipoLink,
              nfe_id: nfeCandidate.id
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      } catch (e) {
        console.warn(`[GET-NFE-BY-ORDER] Erro ao buscar detalhes NF-e ${nfeCandidate.id}:`, e);
      }
    }

    // Nenhuma NF-e válida com DANFE
    return new Response(
      JSON.stringify({ 
        success: true, 
        found: false,
        message: "NF-e encontrada mas DANFE ainda não disponível"
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[GET-NFE-BY-ORDER] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
