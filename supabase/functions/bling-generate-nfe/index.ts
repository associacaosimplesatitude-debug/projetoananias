import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bling_order_id } = await req.json();

    if (!bling_order_id) {
      return new Response(
        JSON.stringify({ error: 'bling_order_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BLING-NFE] Gerando NF-e para pedido: ${bling_order_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Usar integração Penha (vendas presenciais são da loja Penha)
    const tableName = 'bling_config_penha';
    const { data: blingConfig, error: configError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
      .single();

    if (configError || !blingConfig) {
      console.error('[BLING-NFE] Erro ao buscar config:', configError);
      throw new Error('Configuração do Bling não encontrada');
    }

    let accessToken = blingConfig.access_token;

    // Verificar se token expirou
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(
        supabase, 
        blingConfig, 
        tableName,
        blingConfig.client_id!,
        blingConfig.client_secret!
      );
    }

    // 1) Primeiro, verificar se já existe NF-e para este pedido
    console.log(`[BLING-NFE] Verificando NF-es existentes para pedido ${bling_order_id}...`);
    
    const nfeSearchUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${bling_order_id}`;
    const nfeSearchResp = await fetch(nfeSearchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (nfeSearchResp.ok) {
      const nfeSearchData = await nfeSearchResp.json();
      const nfes: any[] = Array.isArray(nfeSearchData?.data) ? nfeSearchData.data : [];
      
      // Procurar NF-e autorizada (situacao = 6)
      const nfeAutorizada = nfes.find((n: any) => Number(n?.situacao) === 6);
      
      if (nfeAutorizada) {
        console.log(`[BLING-NFE] NF-e já existe e está autorizada: ${nfeAutorizada.id}`);
        
        // Buscar detalhes para pegar o link da DANFE
        const nfeDetailUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeAutorizada.id}`;
        const nfeDetailResp = await fetch(nfeDetailUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        if (nfeDetailResp.ok) {
          const nfeDetail = await nfeDetailResp.json();
          const detail = nfeDetail?.data;
          
          // Pegar link da DANFE
          let danfeUrl = detail?.linkDanfe || detail?.link || detail?.linkPdf || null;
          
          // Preferir link doc.view.php (DANFE real)
          if (detail?.link && detail.link.includes('doc.view.php')) {
            danfeUrl = detail.link;
          } else if (detail?.linkDanfe && detail.linkDanfe.includes('doc.view.php')) {
            danfeUrl = detail.linkDanfe;
          }

          console.log(`[BLING-NFE] DANFE URL encontrada: ${danfeUrl}`);

          return new Response(
            JSON.stringify({
              success: true,
              nfe_id: nfeAutorizada.id,
              nfe_numero: detail?.numero || nfeAutorizada.numero,
              nfe_url: danfeUrl,
              nfe_pendente: false,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Se existe NF-e mas não está autorizada, está pendente
      if (nfes.length > 0) {
        console.log(`[BLING-NFE] NF-e existe mas ainda não está autorizada. Situação: ${nfes[0]?.situacao}`);
        return new Response(
          JSON.stringify({
            success: true,
            nfe_pendente: true,
            message: 'NF-e em processamento',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2) Se não existe NF-e, gerar uma nova
    console.log(`[BLING-NFE] Gerando nova NF-e para pedido ${bling_order_id}...`);

    // Buscar dados do pedido para montar a NF-e
    const pedidoUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}`;
    const pedidoResp = await fetch(pedidoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!pedidoResp.ok) {
      console.error('[BLING-NFE] Erro ao buscar pedido:', await pedidoResp.text());
      throw new Error('Não foi possível buscar dados do pedido');
    }

    const pedidoData = await pedidoResp.json();
    const pedido = pedidoData?.data;

    if (!pedido) {
      throw new Error('Pedido não encontrado');
    }

    // Criar NF-e a partir do pedido de venda
    // Endpoint para gerar NF-e: POST /Api/v3/nfe
    const nfePayload = {
      tipo: 1, // 1 = NF-e de Saída
      dataOperacao: new Date().toISOString().split('T')[0],
      contato: pedido.contato,
      itens: pedido.itens?.map((item: any) => ({
        codigo: item.codigo || item.sku,
        descricao: item.descricao,
        unidade: item.unidade || 'UN',
        quantidade: item.quantidade,
        valor: item.valor,
        tipo: 'P', // Produto
      })),
      // Usar natureza de operação padrão para venda
      naturezaOperacao: {
        id: pedido.naturezaOperacao?.id || 1,
      },
      // Transporte
      transporte: pedido.transporte,
    };

    console.log('[BLING-NFE] Payload para criação de NF-e:', JSON.stringify(nfePayload, null, 2));

    const createNfeResp = await fetch('https://www.bling.com.br/Api/v3/nfe', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(nfePayload),
    });

    const createNfeData = await createNfeResp.json();
    console.log('[BLING-NFE] Resposta criação NF-e:', JSON.stringify(createNfeData, null, 2));

    if (!createNfeResp.ok) {
      // Tentar método alternativo: gerar NF-e a partir do pedido
      console.log('[BLING-NFE] Tentando método alternativo: POST /nfe/pedido/{idPedido}');
      
      const altNfeResp = await fetch(`https://www.bling.com.br/Api/v3/nfe/pedido/${bling_order_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      const altNfeData = await altNfeResp.json();
      console.log('[BLING-NFE] Resposta alternativa:', JSON.stringify(altNfeData, null, 2));

      if (!altNfeResp.ok) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Não foi possível gerar a NF-e. Gere manualmente pelo Bling.',
            nfe_pendente: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // NF-e foi criada, mas pode levar alguns segundos para processar
      return new Response(
        JSON.stringify({
          success: true,
          nfe_id: altNfeData?.data?.id,
          nfe_pendente: true,
          message: 'NF-e criada. Aguarde processamento e clique novamente para obter a DANFE.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NF-e criada com sucesso
    const nfeId = createNfeData?.data?.id;

    // Aguardar um pouco e verificar se já foi autorizada
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Buscar detalhes da NF-e criada
    const newNfeDetailUrl = `https://www.bling.com.br/Api/v3/nfe/${nfeId}`;
    const newNfeDetailResp = await fetch(newNfeDetailUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (newNfeDetailResp.ok) {
      const newNfeDetail = await newNfeDetailResp.json();
      const detail = newNfeDetail?.data;
      
      if (Number(detail?.situacao) === 6) {
        // Autorizada!
        let danfeUrl = detail?.linkDanfe || detail?.link || detail?.linkPdf || null;
        
        if (detail?.link && detail.link.includes('doc.view.php')) {
          danfeUrl = detail.link;
        }

        return new Response(
          JSON.stringify({
            success: true,
            nfe_id: nfeId,
            nfe_numero: detail?.numero,
            nfe_url: danfeUrl,
            nfe_pendente: false,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // NF-e criada mas ainda pendente de autorização
    return new Response(
      JSON.stringify({
        success: true,
        nfe_id: nfeId,
        nfe_pendente: true,
        message: 'NF-e criada. Aguarde autorização e clique novamente.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BLING-NFE] Erro:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
