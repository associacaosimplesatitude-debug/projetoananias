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

// Delay para respeitar rate limit do Bling
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { batch_size = 20 } = await req.json().catch(() => ({}));

    console.log('Iniciando backfill de documentos do Bling...');

    // Buscar pedidos sem documento
    const { data: pedidosSemDocumento, error: fetchError } = await supabase
      .from('ebd_shopify_pedidos')
      .select('id, customer_email, customer_name, order_number, shopify_order_id')
      .is('customer_document', null)
      .not('customer_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(batch_size);

    if (fetchError) {
      console.error('Erro ao buscar pedidos:', fetchError);
      throw fetchError;
    }

    if (!pedidosSemDocumento || pedidosSemDocumento.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhum pedido sem documento encontrado',
          processed: 0,
          updated: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${pedidosSemDocumento.length} pedidos sem documento`);

    // Buscar configuração do Bling
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config) {
      console.error('Erro ao buscar config Bling:', configError);
      throw new Error('Configuração do Bling não encontrada');
    }

    let accessToken = config.access_token;
    const clientId = config.client_id;
    const clientSecret = config.client_secret;

    // Verificar se o token está expirado
    if (isTokenExpired(config.token_expires_at)) {
      console.log('Token expirado, renovando...');
      accessToken = await refreshBlingToken(supabase, config, 'bling_config', clientId, clientSecret);
    }

    let updated = 0;
    const results: any[] = [];

    for (const pedido of pedidosSemDocumento) {
      try {
        // Buscar contato no Bling pelo email
        const email = pedido.customer_email?.toLowerCase();
        if (!email) continue;

        console.log(`Buscando contato no Bling para: ${email}`);

        const searchUrl = `https://www.bling.com.br/Api/v3/contatos?pesquisa=${encodeURIComponent(email)}&limite=1`;
        
        const response = await fetch(searchUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        });

        // Se 401, renovar token
        if (response.status === 401) {
          console.log('Token inválido, renovando...');
          accessToken = await refreshBlingToken(supabase, config, 'bling_config', clientId, clientSecret);
          
          const retryResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          });

          if (!retryResponse.ok) {
            console.error(`Erro ao buscar contato (retry): ${retryResponse.status}`);
            continue;
          }

          const retryData = await retryResponse.json();
          const documento = retryData?.data?.[0]?.numeroDocumento;

          if (documento) {
            console.log(`Documento encontrado para ${email}: ${documento}`);
            await supabase
              .from('ebd_shopify_pedidos')
              .update({ customer_document: documento })
              .eq('id', pedido.id);
            updated++;
            results.push({ pedido_id: pedido.id, email, documento, status: 'updated' });
          } else {
            results.push({ pedido_id: pedido.id, email, status: 'not_found' });
          }
        } else if (response.ok) {
          const data = await response.json();
          const documento = data?.data?.[0]?.numeroDocumento;

          if (documento) {
            console.log(`Documento encontrado para ${email}: ${documento}`);
            await supabase
              .from('ebd_shopify_pedidos')
              .update({ customer_document: documento })
              .eq('id', pedido.id);
            updated++;
            results.push({ pedido_id: pedido.id, email, documento, status: 'updated' });
          } else {
            results.push({ pedido_id: pedido.id, email, status: 'not_found' });
          }
        } else {
          console.error(`Erro ao buscar contato: ${response.status}`);
          results.push({ pedido_id: pedido.id, email, status: 'error' });
        }

        // Delay para respeitar rate limit
        await delay(350);

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error(`Erro processando pedido ${pedido.id}:`, errorMessage);
        results.push({ pedido_id: pedido.id, status: 'error', error: errorMessage });
      }
    }

    // Contar quantos ainda faltam
    const { count } = await supabase
      .from('ebd_shopify_pedidos')
      .select('id', { count: 'exact', head: true })
      .is('customer_document', null)
      .not('customer_email', 'is', null);

    console.log(`Backfill concluído: ${updated} de ${pedidosSemDocumento.length} atualizados. Restam: ${count || 0}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: pedidosSemDocumento.length,
        updated,
        remaining: count || 0,
        results
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
