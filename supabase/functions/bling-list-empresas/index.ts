import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  // buffer de 5 min
  return now.getTime() >= expiresAt.getTime() - 5 * 60 * 1000;
}

async function refreshBlingToken(supabase: any, config: any): Promise<string> {
  if (!config.refresh_token) throw new Error("Refresh token não disponível");

  const credentials = btoa(`${config.client_id}:${config.client_secret}`);

  const tokenResponse = await fetch("https://www.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || tokenData?.error) {
    throw new Error(tokenData?.error_description || tokenData?.error?.message || "Erro ao renovar token do Bling");
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 21600));

  const { error: updateError } = await supabase
    .from("bling_config")
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt.toISOString(),
    })
    .eq("id", config.id);

  if (updateError) throw new Error("Erro ao salvar tokens renovados");
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: config, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .single();

    if (configError || !config) throw new Error("Configuração não encontrada");
    if (!config.access_token) throw new Error("Token de acesso não configurado");

    let accessToken = config.access_token;
    if (isTokenExpired(config.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, config);
    }

    // Buscar pedidos recentes para extrair unidadeNegocio IDs
    const ordersUrl = "https://www.bling.com.br/Api/v3/pedidos/vendas?pagina=1&limite=10";
    const ordersResp = await fetch(ordersUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const ordersData = await ordersResp.json();
    const results: any = { orders: ordersData };

    // Se temos pedidos, buscar detalhes do primeiro para ver unidadeNegocio
    if (ordersResp.ok && ordersData?.data?.length > 0) {
      const unidadesEncontradas: any[] = [];
      
      // Buscar detalhes de até 5 pedidos para encontrar diferentes unidades
      for (let i = 0; i < Math.min(5, ordersData.data.length); i++) {
        const orderId = ordersData.data[i].id;
        const detailUrl = `https://www.bling.com.br/Api/v3/pedidos/vendas/${orderId}`;
        const detailResp = await fetch(detailUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });
        
        if (detailResp.ok) {
          const detailData = await detailResp.json();
          const unidade = detailData?.data?.unidadeNegocio;
          if (unidade && !unidadesEncontradas.find(u => u.id === unidade.id)) {
            unidadesEncontradas.push({
              id: unidade.id,
              descricao: unidade.descricao || "Sem descrição",
              pedido_exemplo: orderId,
            });
          }
        }
      }
      
      results.unidadesDeNegocio = unidadesEncontradas;
    }

    // Também buscar depósitos
    const depositosUrl = "https://www.bling.com.br/Api/v3/depositos?pagina=1&limite=100";
    const depositosResp = await fetch(depositosUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    
    if (depositosResp.ok) {
      results.depositos = await depositosResp.json();
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
