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

    // Tentar listar empresas/unidades (filiais) – requer escopo OAuth: empresas
    const url = "https://www.bling.com.br/Api/v3/empresas?pagina=1&limite=100";
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    const rawText = await resp.text();
    let json: any = null;
    try {
      json = rawText ? JSON.parse(rawText) : null;
    } catch {
      json = { raw: rawText };
    }

    return new Response(
      JSON.stringify(
        {
          ok: resp.ok,
          status: resp.status,
          url,
          data: json,
        },
        null,
        2,
      ),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
