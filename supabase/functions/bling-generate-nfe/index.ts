import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper para extrair mensagem de erro fiscal do Bling
function extractFiscalError(data: any): string | null {
  if (!data) return null;
  
  // Tentar diferentes formatos de erro do Bling
  if (data.error?.message) return data.error.message;
  if (data.error?.description) return data.error.description;
  if (data.message) return data.message;
  if (data.mensagem) return data.mensagem;
  
  // Array de erros
  if (Array.isArray(data.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message || e.mensagem || JSON.stringify(e)).join('; ');
  }
  if (Array.isArray(data.erros) && data.erros.length > 0) {
    return data.erros.map((e: any) => e.message || e.mensagem || JSON.stringify(e)).join('; ');
  }
  
  // Estrutura data.error com campos específicos
  if (data.error?.fields) {
    const fieldErrors = Object.entries(data.error.fields)
      .map(([field, msg]) => `${field}: ${msg}`)
      .join('; ');
    if (fieldErrors) return fieldErrors;
  }
  
  return null;
}

// Função para renovar o token do Bling
async function refreshBlingToken(supabase: any, config: any, tableName: string, clientId: string, clientSecret: string): Promise<string> {
  if (!config.refresh_token) {
    throw new Error('Refresh token não disponível');
  }

  console.log(`[${tableName}] Renovando token do Bling...`);
  
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
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

// Helper para extrair DANFE URL
function extractDanfeUrl(nfeDetail: any): string | null {
  if (!nfeDetail) return null;
  
  // Preferir link doc.view.php (DANFE real)
  if (nfeDetail.link && nfeDetail.link.includes('doc.view.php')) {
    return nfeDetail.link;
  }
  if (nfeDetail.linkDanfe && nfeDetail.linkDanfe.includes('doc.view.php')) {
    return nfeDetail.linkDanfe;
  }
  
  return nfeDetail.linkDanfe || nfeDetail.link || nfeDetail.linkPdf || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bling_order_id } = await req.json();

    if (!bling_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'bling_order_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[BLING-NFE] ===== INICIANDO GERAÇÃO DE NF-e para pedido: ${bling_order_id} =====`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Usar integração RJ (todas as vendas presenciais usam bling_config RJ)
    const tableName = 'bling_config';
    console.log(`[BLING-NFE] Usando configuração: ${tableName}`);
    
    const { data: blingConfig, error: configError } = await supabase
      .from(tableName)
      .select('*')
      .single();

    if (configError || !blingConfig) {
      console.error('[BLING-NFE] Erro ao buscar config:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração do Bling não encontrada', stage: 'config' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    // =======================================================================
    // PASSO 0: VERIFICAR SE O PEDIDO EXISTE NO BLING
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 0: Verificando pedido ${bling_order_id}...`);

    const checkPedidoUrl = `https://api.bling.com.br/Api/v3/pedidos/vendas/${bling_order_id}`;
    const checkPedidoResp = await fetch(checkPedidoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!checkPedidoResp.ok) {
      const checkError = await checkPedidoResp.json().catch(() => ({}));
      const errorMsg = extractFiscalError(checkError) || 'Pedido não encontrado';
      console.log(`[BLING-NFE] ✗ Pedido não encontrado (${checkPedidoResp.status}): ${errorMsg}`);

      return new Response(
        JSON.stringify({
          success: false,
          stage: 'check_order',
          bling_status: checkPedidoResp.status,
          fiscal_error: `Pedido #${bling_order_id} não encontrado no Bling. Aguarde alguns segundos e tente novamente.`,
          raw: checkError,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pedidoData = await checkPedidoResp.json();
    const pedido = pedidoData?.data;
    console.log(`[BLING-NFE] ✓ Pedido encontrado: #${pedido?.numero}`);

    // VALIDAÇÃO CRÍTICA: Verificar se tem natureza de operação
    if (!pedido?.naturezaOperacao?.id) {
      console.log(`[BLING-NFE] ✗ ERRO: Pedido sem natureza de operação - bloqueando emissão`);
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'missing_natureza',
          fiscal_error: 'Pedido sem Natureza de Operação. O pedido precisa ser recriado com a natureza correta.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log(`[BLING-NFE] ✓ Natureza de operação confirmada: ${pedido.naturezaOperacao.id}`);

    // =======================================================================
    // PASSO 1: CRIAR NF-e via POST /nfe/vendas/{id} (ENDPOINT CORRETO V3)
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 1: Criando NF-e via POST /nfe/vendas/${bling_order_id}`);

    const createNfeUrl = `https://api.bling.com.br/Api/v3/nfe/vendas/${bling_order_id}`;
    const createNfeResp = await fetch(createNfeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const createNfeData = await createNfeResp.json();
    console.log(`[BLING-NFE] Status criação: ${createNfeResp.status}`);
    console.log(`[BLING-NFE] Resposta criação:`, JSON.stringify(createNfeData, null, 2));

    let nfeId: number | null = null;

    // Analisar resposta da criação
    if (createNfeResp.ok && createNfeData?.data?.id) {
      // SUCESSO: NF-e criada!
      nfeId = createNfeData.data.id;
      console.log(`[BLING-NFE] ✓ NF-e criada com sucesso! ID: ${nfeId}`);
      
    } else if (createNfeResp.status === 409 || createNfeResp.status === 422) {
      // Possível duplicidade - NF-e já existe para este pedido
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] Status ${createNfeResp.status}: ${fiscalError}`);
      
      // Verificar se é erro de duplicidade
      const isDuplicate = fiscalError?.toLowerCase().includes('já existe') ||
                          fiscalError?.toLowerCase().includes('duplicad') ||
                          fiscalError?.toLowerCase().includes('already exists') ||
                          createNfeData?.data?.id; // Às vezes retorna 422 mas com o ID
      
      if (isDuplicate || createNfeData?.data?.id) {
        nfeId = createNfeData?.data?.id;
        console.log(`[BLING-NFE] NF-e já existe para este pedido. ID: ${nfeId || 'buscando...'}`);
        
        // Se não veio o ID, buscar a NF-e existente
        if (!nfeId) {
          console.log(`[BLING-NFE] Buscando NF-e existente para pedido ${bling_order_id}...`);
          const searchUrl = `https://api.bling.com.br/Api/v3/nfe?idPedidoVenda=${bling_order_id}`;
          const searchResp = await fetch(searchUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });
          
          if (searchResp.ok) {
            const searchData = await searchResp.json();
            const nfes = Array.isArray(searchData?.data) ? searchData.data : [];
            if (nfes.length > 0) {
              nfeId = nfes[0].id;
              console.log(`[BLING-NFE] NF-e encontrada: ${nfeId}`);
            }
          }
        }
        
        if (!nfeId) {
          return new Response(
            JSON.stringify({
              success: false,
              stage: 'create',
              fiscal_error: fiscalError || 'NF-e pode já existir mas não foi possível localizá-la. Verifique no Bling.',
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        // Erro fiscal real (não é duplicidade)
        console.log(`[BLING-NFE] ✗ Erro fiscal na criação: ${fiscalError}`);
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'create',
            bling_status: createNfeResp.status,
            fiscal_error: fiscalError || 'Erro ao criar NF-e. Verifique os dados do pedido no Bling.',
            raw: createNfeData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
    } else if (createNfeResp.status === 400) {
      // Erro de validação - mostrar erro fiscal detalhado
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] ✗ Erro 400 na criação: ${fiscalError}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          bling_status: 400,
          fiscal_error: fiscalError || 'Dados do pedido incompletos ou inválidos. Verifique cliente, endereço e natureza de operação no Bling.',
          raw: createNfeData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } else {
      // Outro erro
      const fiscalError = extractFiscalError(createNfeData);
      console.log(`[BLING-NFE] ✗ Erro ${createNfeResp.status} na criação: ${fiscalError}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'create',
          bling_status: createNfeResp.status,
          fiscal_error: fiscalError || `Erro inesperado ao criar NF-e (código ${createNfeResp.status}).`,
          raw: createNfeData,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =======================================================================
    // PASSO 2: ENVIAR NF-e para SEFAZ via POST /nfe/{id}/enviar
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 2: Enviando NF-e ${nfeId} para SEFAZ...`);
    
    const sendNfeUrl = `https://api.bling.com.br/Api/v3/nfe/${nfeId}/enviar`;
    const sendNfeResp = await fetch(sendNfeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    const sendNfeData = await sendNfeResp.json();
    console.log(`[BLING-NFE] Status envio: ${sendNfeResp.status}`);
    console.log(`[BLING-NFE] Resposta envio:`, JSON.stringify(sendNfeData, null, 2));

    if (!sendNfeResp.ok) {
      const fiscalError = extractFiscalError(sendNfeData);
      
      // Verificar se é erro de "já enviada"
      const alreadySent = fiscalError?.toLowerCase().includes('já enviada') ||
                          fiscalError?.toLowerCase().includes('already sent') ||
                          fiscalError?.toLowerCase().includes('autorizada');
      
      if (!alreadySent) {
        console.log(`[BLING-NFE] ✗ Erro ao enviar para SEFAZ: ${fiscalError}`);
        return new Response(
          JSON.stringify({
            success: false,
            stage: 'send',
            bling_status: sendNfeResp.status,
            fiscal_error: fiscalError || 'Erro ao enviar NF-e para SEFAZ. Verifique os dados fiscais no Bling.',
            nfe_id: nfeId,
            raw: sendNfeData,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log(`[BLING-NFE] NF-e já foi enviada anteriormente, verificando status...`);
    } else {
      console.log(`[BLING-NFE] ✓ NF-e enviada para SEFAZ com sucesso!`);
    }

    // =======================================================================
    // PASSO 3: AGUARDAR e VERIFICAR STATUS
    // =======================================================================
    console.log(`[BLING-NFE] PASSO 3: Aguardando processamento...`);
    await new Promise(resolve => setTimeout(resolve, 2500));

    console.log(`[BLING-NFE] Verificando status da NF-e ${nfeId}...`);
    const checkNfeUrl = `https://api.bling.com.br/Api/v3/nfe/${nfeId}`;
    const checkNfeResp = await fetch(checkNfeUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!checkNfeResp.ok) {
      console.log(`[BLING-NFE] Erro ao verificar NF-e: ${checkNfeResp.status}`);
      return new Response(
        JSON.stringify({
          success: true,
          nfe_id: nfeId,
          nfe_pendente: true,
          message: 'NF-e criada e enviada. Aguarde autorização e tente novamente.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const checkNfeData = await checkNfeResp.json();
    const nfeDetail = checkNfeData?.data;
    const situacao = Number(nfeDetail?.situacao);
    
    console.log(`[BLING-NFE] Situação NF-e: ${situacao} (6=Autorizada)`);

    if (situacao === 6) {
      // AUTORIZADA!
      const danfeUrl = extractDanfeUrl(nfeDetail);
      console.log(`[BLING-NFE] ✓ NF-e AUTORIZADA! DANFE: ${danfeUrl}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          nfe_id: nfeId,
          nfe_numero: nfeDetail?.numero,
          nfe_url: danfeUrl,
          nfe_pendente: false,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // NF-e ainda não autorizada
    console.log(`[BLING-NFE] NF-e ainda pendente (situação: ${situacao})`);
    
    // Verificar se há erro de rejeição
    if (situacao === 4 || situacao === 5) { // Rejeitada ou com erro
      const rejectReason = nfeDetail?.motivoRejeicao || nfeDetail?.erroEnvio || 'Motivo não informado';
      console.log(`[BLING-NFE] NF-e rejeitada/com erro: ${rejectReason}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          stage: 'authorization',
          nfe_id: nfeId,
          fiscal_error: `NF-e rejeitada pela SEFAZ: ${rejectReason}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        nfe_id: nfeId,
        nfe_numero: nfeDetail?.numero,
        nfe_pendente: true,
        message: 'NF-e enviada para SEFAZ. Aguarde autorização e clique novamente em alguns segundos.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[BLING-NFE] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stage: 'unknown',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
