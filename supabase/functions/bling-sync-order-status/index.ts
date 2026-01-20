import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapeamento de status Bling para status interno
const BLING_STATUS_MAP: Record<number, { interno: string; nome: string }> = {
  28: { interno: 'EM_ABERTO', nome: 'Em aberto' },
  31: { interno: 'ATENDIDO', nome: 'Atendido' },
  34: { interno: 'CANCELADO', nome: 'Cancelado' },
  37: { interno: 'EM_ANDAMENTO', nome: 'Em andamento' },
};

// deno-lint-ignore no-explicit-any
type AnySupabase = any;
// deno-lint-ignore no-explicit-any
type AnyConfig = any;

// Função para renovar token do Bling
async function refreshBlingToken(
  supabase: AnySupabase,
  config: AnyConfig,
  tableName: string
): Promise<string> {
  const clientId = config.client_id as string;
  const clientSecret = config.client_secret as string;
  const refreshToken = config.refresh_token as string;

  if (!refreshToken) {
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
      refresh_token: refreshToken,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok || tokenData.error) {
    console.error(`[${tableName}] Erro ao renovar token:`, tokenData);
    throw new Error(tokenData.error_description || 'Erro ao renovar token do Bling');
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  await supabase
    .from(tableName)
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq('id', config.id);

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

// Buscar pedido no Bling por ID
async function fetchBlingOrder(accessToken: string, blingOrderId: number): Promise<Record<string, unknown> | null> {
  const url = `https://www.bling.com.br/Api/v3/pedidos/vendas/${blingOrderId}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (response.status === 404) {
    console.log(`Pedido ${blingOrderId} não encontrado no Bling`);
    return null;
  }

  if (response.status === 429) {
    console.log('Rate limit atingido, aguardando...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    return fetchBlingOrder(accessToken, blingOrderId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Erro ao buscar pedido ${blingOrderId}:`, errorText);
    return null;
  }

  const data = await response.json();
  return data?.data || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('=== BLING SYNC ORDER STATUS - INICIANDO ===');

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parâmetros opcionais
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Body vazio é ok para cron
    }

    const limitParam = body.limit as number || 50;
    const forceSync = body.force === true;

    // Buscar propostas com bling_order_id que precisam de sync
    // Sincronizar pedidos que não foram sincronizados nas últimas 30 minutos
    const syncThreshold = new Date();
    syncThreshold.setMinutes(syncThreshold.getMinutes() - 30);

    let query = supabase
      .from('vendedor_propostas')
      .select('id, bling_order_id, bling_order_number, status, bling_status, bling_synced_at, cliente_nome')
      .not('bling_order_id', 'is', null)
      .order('bling_synced_at', { ascending: true, nullsFirst: true })
      .limit(limitParam);

    // Se não forçar, pegar apenas os que precisam de sync
    if (!forceSync) {
      query = query.or(`bling_synced_at.is.null,bling_synced_at.lt.${syncThreshold.toISOString()}`);
    }

    const { data: propostas, error: propostasError } = await query;

    if (propostasError) {
      console.error('Erro ao buscar propostas:', propostasError);
      throw new Error('Erro ao buscar propostas para sincronização');
    }

    if (!propostas || propostas.length === 0) {
      console.log('Nenhuma proposta para sincronizar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhuma proposta para sincronizar', synced: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontradas ${propostas.length} propostas para sincronizar`);

    // Buscar configuração do Bling (usando config padrão RJ)
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar config Bling:', configError);
      throw new Error('Configuração do Bling não encontrada');
    }

    let accessToken = config.access_token;

    // Verificar se o token está expirado
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado, renovando...');
      accessToken = await refreshBlingToken(supabase, config, 'bling_config');
    }

    // Processar cada proposta
    const results: { id: string; success: boolean; status?: string | null; error?: string }[] = [];
    
    // Coletar pedidos que mudaram para ATENDIDO (ID 31) para trigger automático de NF-e
    const pedidosAtendidos: number[] = [];

    for (const proposta of propostas) {
      try {
        const blingOrderId = proposta.bling_order_id as number;
        console.log(`Sincronizando proposta ${proposta.id} (Bling #${blingOrderId})`);

        const blingOrder = await fetchBlingOrder(accessToken, blingOrderId);

        if (!blingOrder) {
          console.log(`Pedido ${blingOrderId} não encontrado no Bling, marcando sync`);
          await supabase
            .from('vendedor_propostas')
            .update({ bling_synced_at: new Date().toISOString() })
            .eq('id', proposta.id);
          
          results.push({ id: proposta.id, success: true, status: 'NOT_FOUND' });
          continue;
        }

        // Extrair status do pedido no Bling
        const situacao = blingOrder.situacao as { id?: number; valor?: string } | undefined;
        const blingStatusId = situacao?.id || null;
        const blingStatusNome = situacao?.valor || null;

        console.log(`Pedido ${blingOrderId}: Status Bling = ${blingStatusNome} (ID: ${blingStatusId})`);

        // Atualizar proposta com status do Bling
        const updateData: Record<string, unknown> = {
          bling_status: blingStatusNome,
          bling_status_id: blingStatusId,
          bling_synced_at: new Date().toISOString(),
        };

        // Atualizar status interno se o pedido foi cancelado no Bling
        if (blingStatusId === 34 && proposta.status !== 'CANCELADA') {
          console.log(`Pedido ${blingOrderId} foi CANCELADO no Bling, atualizando status interno`);
          updateData.status = 'CANCELADA';
        }

        // Se foi atendido no Bling, marcar como FATURADO_ENTREGUE e adicionar à lista para sync de NF-e
        if (blingStatusId === 31 && proposta.status !== 'FATURADO_ENTREGUE') {
          console.log(`Pedido ${blingOrderId} foi ATENDIDO no Bling - disparando sync de NF-e`);
          updateData.status = 'FATURADO_ENTREGUE';
          pedidosAtendidos.push(blingOrderId);
        }

        const { error: updateError } = await supabase
          .from('vendedor_propostas')
          .update(updateData)
          .eq('id', proposta.id);

        if (updateError) {
          console.error(`Erro ao atualizar proposta ${proposta.id}:`, updateError);
          results.push({ id: proposta.id, success: false, error: updateError.message });
        } else {
          results.push({ id: proposta.id, success: true, status: blingStatusNome });
        }

        // Pequeno delay para evitar rate limit
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`Erro ao processar proposta ${proposta.id}:`, err);
        results.push({ 
          id: proposta.id, 
          success: false, 
          error: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }

    // Trigger automático: chamar sync-comissoes-nfe para os pedidos que foram ATENDIDOS
    let nfeSyncResult = null;
    if (pedidosAtendidos.length > 0) {
      console.log(`Triggering sync-comissoes-nfe for ${pedidosAtendidos.length} ATENDIDO orders:`, pedidosAtendidos);
      try {
        const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-comissoes-nfe', {
          body: { bling_order_ids: pedidosAtendidos }
        });
        
        if (syncError) {
          console.error('Erro ao chamar sync-comissoes-nfe:', syncError);
          nfeSyncResult = { success: false, error: syncError.message };
        } else {
          console.log('sync-comissoes-nfe result:', syncData);
          nfeSyncResult = syncData;
        }
      } catch (invokeErr) {
        console.error('Erro ao invocar sync-comissoes-nfe:', invokeErr);
        nfeSyncResult = { success: false, error: invokeErr instanceof Error ? invokeErr.message : 'Erro' };
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    console.log(`=== SYNC CONCLUÍDO: ${successCount} sucesso, ${failCount} falhas, ${pedidosAtendidos.length} NF-e triggered (${duration}ms) ===`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: successCount,
        failed: failCount,
        nfe_triggered: pedidosAtendidos.length,
        nfe_sync_result: nfeSyncResult,
        duration_ms: duration,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na sincronização:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
