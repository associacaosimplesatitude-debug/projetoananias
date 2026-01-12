import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ID da loja Shopify no Bling (E-COMMERCE channel)
const SHOPIFY_LOJA_ID_BLING = 205391854;

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
    console.log('Token inválido, renovando...');
    token = await refreshBlingToken(supabase, config, 'bling_config', config.client_id, config.client_secret);
    
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
    console.error('Erro Bling API:', response.status, errorText);
    throw new Error(`Erro Bling API: ${response.status}`);
  }

  const data = await response.json();
  return { data, newToken: token !== accessToken ? token : undefined };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { pedido_ids, cliente_id } = await req.json();

    // Buscar pedidos a sincronizar
    let query = supabase
      .from('ebd_shopify_pedidos')
      .select('id, order_number, shopify_order_id, bling_order_id');

    if (pedido_ids && pedido_ids.length > 0) {
      query = query.in('id', pedido_ids);
    } else if (cliente_id) {
      query = query.eq('cliente_id', cliente_id);
    } else {
      return new Response(
        JSON.stringify({ error: "pedido_ids ou cliente_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: pedidos, error: pedidosError } = await query;

    if (pedidosError) {
      console.error('Erro ao buscar pedidos:', pedidosError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar pedidos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pedidos || pedidos.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum pedido para sincronizar', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sincronizando ${pedidos.length} pedidos com Bling...`);

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

    let syncedCount = 0;
    const errors: string[] = [];

    for (const pedido of pedidos) {
      try {
        // Extrair número do pedido (remover # se houver)
        const orderNumber = pedido.order_number.replace('#', '');
        console.log(`Processando pedido ${orderNumber}...`);

        let blingOrderId = pedido.bling_order_id;

        // Se ainda não temos o ID do Bling, buscar pelo numeroLoja
        if (!blingOrderId) {
          const searchUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas?idLoja=${SHOPIFY_LOJA_ID_BLING}&numeroLoja=${orderNumber}&limite=1`;
          console.log(`Buscando pedido no Bling: ${searchUrl}`);

          const searchResult = await blingApiCall(searchUrl, accessToken, supabase, config);
          if (searchResult.newToken) accessToken = searchResult.newToken;

          const blingPedidos = searchResult.data?.data || [];
          if (blingPedidos.length === 0) {
            console.log(`Pedido ${orderNumber} não encontrado no Bling`);
            continue;
          }

          blingOrderId = blingPedidos[0].id;
          console.log(`Pedido ${orderNumber} encontrado no Bling: ID ${blingOrderId}`);
        }

        // Buscar detalhes do pedido no Bling
        const detailUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
        console.log(`Buscando detalhes do pedido: ${detailUrl}`);

        const detailResult = await blingApiCall(detailUrl, accessToken, supabase, config);
        if (detailResult.newToken) accessToken = detailResult.newToken;

        const blingOrder = detailResult.data?.data;
        if (!blingOrder) {
          console.log(`Detalhes do pedido ${blingOrderId} não encontrados`);
          continue;
        }

        // Extrair dados do pedido Bling
        const situacao = blingOrder.situacao || {};
        const transporte = blingOrder.transporte || {};
        const volumes = transporte.volumes || [];
        
        // Buscar código de rastreio dos volumes
        let codigoRastreio = null;
        for (const volume of volumes) {
          if (volume.codigoRastreamento) {
            codigoRastreio = volume.codigoRastreamento;
            break;
          }
        }

        // Buscar NF-e vinculada ao pedido
        let notaFiscalNumero = null;
        let notaFiscalChave = null;
        let notaFiscalUrl = null;

        try {
          const nfeUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${blingOrderId}`;
          console.log(`Buscando NF-e: ${nfeUrl}`);

          const nfeResult = await blingApiCall(nfeUrl, accessToken, supabase, config);
          if (nfeResult.newToken) accessToken = nfeResult.newToken;

          const nfes = nfeResult.data?.data || [];
          if (nfes.length > 0) {
            const nfe = nfes[0];
            notaFiscalNumero = nfe.numero;
            notaFiscalChave = nfe.chaveAcesso;
            
            // Buscar link do DANFE se tiver o ID da NF-e
            if (nfe.id) {
              try {
                const danfeUrl = `https://www.bling.com.br/Api/v3/nfe/${nfe.id}`;
                const danfeResult = await blingApiCall(danfeUrl, accessToken, supabase, config);
                if (danfeResult.newToken) accessToken = danfeResult.newToken;
                
                const nfeDetail = danfeResult.data?.data;
                if (nfeDetail?.linkDanfe) {
                  notaFiscalUrl = nfeDetail.linkDanfe;
                } else if (nfeDetail?.xml) {
                  // Se não tiver linkDanfe, tentar gerar URL padrão
                  notaFiscalUrl = `https://www.bling.com.br/relatorios/nfe.php?s&chaveAcesso=${notaFiscalChave}`;
                }
              } catch (danfeError) {
                console.warn(`Aviso: Não foi possível buscar DANFE para NF-e ${nfe.id}`);
              }
            }
          }
        } catch (nfeError) {
          console.warn(`Aviso: Não foi possível buscar NF-e para pedido ${blingOrderId}`);
        }

        // Atualizar pedido no banco
        const updateData: any = {
          bling_order_id: blingOrderId,
          bling_status: situacao.valor || null,
          bling_status_id: situacao.id || null,
        };

        if (codigoRastreio) {
          updateData.codigo_rastreio_bling = codigoRastreio;
        }

        if (notaFiscalNumero) {
          updateData.nota_fiscal_numero = notaFiscalNumero;
        }

        if (notaFiscalChave) {
          updateData.nota_fiscal_chave = notaFiscalChave;
        }

        if (notaFiscalUrl) {
          updateData.nota_fiscal_url = notaFiscalUrl;
        }

        console.log(`Atualizando pedido ${pedido.id}:`, updateData);

        const { error: updateError } = await supabase
          .from('ebd_shopify_pedidos')
          .update(updateData)
          .eq('id', pedido.id);

        if (updateError) {
          console.error(`Erro ao atualizar pedido ${pedido.id}:`, updateError);
          errors.push(`Pedido ${orderNumber}: ${updateError.message}`);
        } else {
          syncedCount++;
          console.log(`Pedido ${orderNumber} sincronizado com sucesso!`);
        }

      } catch (pedidoError) {
        const errorMsg = pedidoError instanceof Error ? pedidoError.message : 'Erro desconhecido';
        console.error(`Erro ao processar pedido ${pedido.order_number}:`, errorMsg);
        errors.push(`Pedido ${pedido.order_number}: ${errorMsg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        total: pedidos.length,
        errors: errors.length > 0 ? errors : undefined,
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
