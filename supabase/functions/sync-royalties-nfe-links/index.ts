import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function isTokenExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  const expiry = new Date(expiresAt);
  return expiry <= new Date();
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  console.log('[refreshBlingToken] Refreshing token...');
  
  const credentials = btoa(`${config.client_id}:${config.client_secret}`);
  const response = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh token: ${errorText}`);
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from('bling_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', config.id);

  console.log('[refreshBlingToken] Token refreshed successfully');
  return tokenData.access_token;
}

async function blingApiCall(
  url: string,
  accessToken: string,
  retries = 2
): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        console.log(`[blingApiCall] Rate limited, waiting 2s...`);
        await delay(2000);
        continue;
      }

      if (response.status === 404) {
        return { notFound: true };
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bling API error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await delay(1000);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[sync-royalties-nfe-links] Starting NF links sync...');

    // Fetch Bling config
    const { data: blingConfig, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .limit(1)
      .single();

    if (configError || !blingConfig) {
      throw new Error('Configuração Bling não encontrada');
    }

    let accessToken = blingConfig.access_token;

    // Refresh token if expired
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    // Fetch sales with bling_order_id but no nota_fiscal_url
    const { data: vendasSemNF, error: vendasError } = await supabase
      .from('royalties_vendas')
      .select('id, bling_order_id, bling_order_number')
      .not('bling_order_id', 'is', null)
      .is('nota_fiscal_url', null);

    if (vendasError) {
      throw new Error(`Erro ao buscar vendas: ${vendasError.message}`);
    }

    console.log(`[sync-royalties-nfe-links] Found ${vendasSemNF?.length || 0} sales without NF links`);

    const results = {
      total: vendasSemNF?.length || 0,
      success: 0,
      failed: 0,
      errors: [] as { id: string; bling_order_id: number; error: string }[],
    };

    if (!vendasSemNF || vendasSemNF.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhuma venda pendente de NF encontrada',
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each sale
    for (const venda of vendasSemNF) {
      try {
        console.log(`[sync-royalties-nfe-links] Processing venda ${venda.id} with bling_order_id ${venda.bling_order_id}`);
        
        // The bling_order_id in royalties_vendas is actually the NFe ID (from the sync)
        const nfeUrl = `https://www.bling.com.br/Api/v3/nfe/${venda.bling_order_id}`;
        const nfeResult = await blingApiCall(nfeUrl, accessToken);

        if (nfeResult.notFound) {
          results.failed++;
          results.errors.push({
            id: venda.id,
            bling_order_id: venda.bling_order_id,
            error: 'NF-e não encontrada no Bling',
          });
          continue;
        }

        const nfeData = nfeResult?.data;
        if (!nfeData) {
          results.failed++;
          results.errors.push({
            id: venda.id,
            bling_order_id: venda.bling_order_id,
            error: 'Dados da NF-e vazios',
          });
          continue;
        }

        // Check if NF-e is authorized (situacao.id === 6)
        const situacaoId = nfeData.situacao?.id || nfeData.situacao;
        if (situacaoId !== 6) {
          results.failed++;
          results.errors.push({
            id: venda.id,
            bling_order_id: venda.bling_order_id,
            error: `NF-e não autorizada (situação: ${situacaoId})`,
          });
          continue;
        }

        // Extract NF number and link
        const nfeNumero = nfeData.numero?.toString() || venda.bling_order_number;
        const linkDanfe = 
          nfeData.linkPDF || 
          nfeData.linkDanfe || 
          nfeData.link_danfe ||
          nfeData.xml?.danfe ||
          nfeData.pdf ||
          null;

        if (!linkDanfe) {
          results.failed++;
          results.errors.push({
            id: venda.id,
            bling_order_id: venda.bling_order_id,
            error: 'Link DANFE não disponível',
          });
          continue;
        }

        // Update the sale record
        const { error: updateError } = await supabase
          .from('royalties_vendas')
          .update({
            nota_fiscal_numero: nfeNumero,
            nota_fiscal_url: linkDanfe,
          })
          .eq('id', venda.id);

        if (updateError) {
          results.failed++;
          results.errors.push({
            id: venda.id,
            bling_order_id: venda.bling_order_id,
            error: `Erro ao atualizar: ${updateError.message}`,
          });
        } else {
          results.success++;
          console.log(`[sync-royalties-nfe-links] ✓ Updated venda ${venda.id} with NF ${nfeNumero}`);
        }

        // Rate limit: 300ms between calls
        await delay(300);
      } catch (error) {
        results.failed++;
        results.errors.push({
          id: venda.id,
          bling_order_id: venda.bling_order_id,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
      }
    }

    console.log(`[sync-royalties-nfe-links] Complete: ${results.success} success, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída: ${results.success} atualizados, ${results.failed} falhas`,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[sync-royalties-nfe-links] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
