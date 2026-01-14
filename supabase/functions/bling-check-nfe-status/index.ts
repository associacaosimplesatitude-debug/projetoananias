import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extrai a URL do DANFE de diferentes lugares na resposta
function extractDanfeUrl(nfeDetail: any): string | null {
  // Primeiro: PDF gerado pelo Bling
  if (nfeDetail?.linkDanfe) return nfeDetail.linkDanfe;
  if (nfeDetail?.xml?.linkDanfe) return nfeDetail.xml.linkDanfe;
  
  // Segundo: XML disponível
  if (nfeDetail?.xml?.link) return nfeDetail.xml.link;
  
  // Terceiro: tentar links do documento
  const links = nfeDetail?.links;
  if (Array.isArray(links)) {
    const danfeLink = links.find((l: any) => l.rel === 'danfe' || l.rel === 'pdf');
    if (danfeLink?.href) return danfeLink.href;
  }
  
  return null;
}

// Verifica se o token expirou
function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  return now >= expiresAt;
}

// Refresh do token do Bling
async function refreshBlingToken(
  supabase: any,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  
  const tokenResp = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
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

  if (!tokenResp.ok) {
    throw new Error('Falha ao renovar token do Bling');
  }

  const tokenData = await tokenResp.json();
  const newAccessToken = tokenData.access_token;
  const newRefreshToken = tokenData.refresh_token;
  const expiresIn = tokenData.expires_in || 21600;
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await supabase
    .from('bling_config')
    .update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', (await supabase.from('bling_config').select('id').limit(1).single()).data.id);

  return newAccessToken;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { nfe_id, venda_id } = await req.json();

    if (!nfe_id) {
      return new Response(
        JSON.stringify({ success: false, error: "nfe_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CHECK-NFE] Verificando status da NF-e ID: ${nfe_id}`);

    // Inicializar Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar config do Bling (mesma config que bling-generate-nfe usa)
    const { data: blingConfig, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .limit(1)
      .single();

    if (configError || !blingConfig) {
      throw new Error("Configuração Bling não encontrada");
    }

    let accessToken = blingConfig.access_token;

    // Verificar se precisa renovar token
    if (isTokenExpired(blingConfig.token_expires_at)) {
      console.log("[CHECK-NFE] Token expirado, renovando...");
      accessToken = await refreshBlingToken(
        supabase,
        blingConfig.refresh_token,
        blingConfig.client_id,
        blingConfig.client_secret
      );
    }

    // Buscar NF-e no Bling
    const nfeResp = await fetch(`https://api.bling.com.br/Api/v3/nfe/${nfe_id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!nfeResp.ok) {
      const errText = await nfeResp.text();
      console.error(`[CHECK-NFE] Erro ao buscar NF-e: ${nfeResp.status}`, errText);
      return new Response(
        JSON.stringify({ success: false, error: "NF-e não encontrada no Bling", status: nfeResp.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const nfeData = await nfeResp.json();
    const nfeDetail = nfeData?.data;
    const situacao = Number(nfeDetail?.situacao);

    console.log(`[CHECK-NFE] Situação atual: ${situacao}`, JSON.stringify(nfeDetail).slice(0, 500));

    // Situação 6 = Autorizada
    if (situacao === 6) {
      const nfeNumero = nfeDetail?.numero;
      const nfeChave = nfeDetail?.chaveAcesso;
      const danfeUrl = extractDanfeUrl(nfeDetail);

      console.log(`[CHECK-NFE] ✓ NF-e AUTORIZADA! Número: ${nfeNumero}, Chave: ${nfeChave}, DANFE: ${danfeUrl}`);

      // Atualizar vendas_balcao
      const updatePayload: any = {
        status_nfe: 'AUTORIZADA',
        nota_fiscal_numero: String(nfeNumero),
        nota_fiscal_chave: nfeChave,
        nota_fiscal_url: danfeUrl,
      };

      let updated = false;

      // Tentar atualizar por venda_id primeiro
      if (venda_id) {
        const { data: vendaUpdate, error: vendaError } = await supabase
          .from('vendas_balcao')
          .update(updatePayload)
          .eq('id', venda_id)
          .select('id')
          .maybeSingle();

        if (vendaUpdate) {
          updated = true;
          console.log(`[CHECK-NFE] ✓ vendas_balcao atualizado por venda_id`);
        }
      }

      // Fallback: atualizar por nfe_id
      if (!updated) {
        const { data: vendaUpdate2 } = await supabase
          .from('vendas_balcao')
          .update(updatePayload)
          .eq('nfe_id', nfe_id)
          .select('id')
          .maybeSingle();

        if (vendaUpdate2) {
          updated = true;
          console.log(`[CHECK-NFE] ✓ vendas_balcao atualizado por nfe_id`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: true,
          status_nfe: 'AUTORIZADA',
          nota_fiscal_numero: nfeNumero,
          nota_fiscal_chave: nfeChave,
          nota_fiscal_url: danfeUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Situação 7 = Rejeitada / 8 = Denegada
    if (situacao === 7 || situacao === 8) {
      const statusFinal = situacao === 7 ? 'REJEITADA' : 'DENEGADA';
      
      if (venda_id) {
        await supabase
          .from('vendas_balcao')
          .update({ status_nfe: statusFinal })
          .eq('id', venda_id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: true,
          status_nfe: statusFinal,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ainda processando (situação 1, 2, 3, 4, 5)
    return new Response(
      JSON.stringify({
        success: true,
        updated: false,
        status_nfe: 'PROCESSANDO',
        situacao_bling: situacao,
        message: 'NF-e ainda em processamento no Bling',
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[CHECK-NFE] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
