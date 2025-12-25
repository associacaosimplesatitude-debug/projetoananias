import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  if (!tokenResponse.ok || tokenData.error) {
    console.error("Erro ao renovar token:", tokenData);
    throw new Error(tokenData.error_description || "Erro ao renovar token do Bling");
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

  if (updateError) {
    console.error("Erro ao salvar tokens:", updateError);
    throw new Error("Erro ao salvar tokens renovados");
  }

  return tokenData.access_token;
}

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (!tokenExpiresAt) return true;
  const expiresAt = new Date(tokenExpiresAt);
  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  return now.getTime() >= expiresAt.getTime() - bufferMs;
}

function safeString(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") return (val.nome || val.value || val.descricao || "").toString().trim();
  return "";
}

function normalizeText(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function extractContactName(contato: any): string {
  return (
    safeString(contato?.nome) ||
    safeString(contato?.nomeFantasia) ||
    safeString(contato?.razaoSocial) ||
    safeString(contato?.descricao)
  );
}

function extractEmail(contato: any): string {
  const direct = safeString(
    contato?.email ||
      contato?.emailNfe ||
      contato?.emailNF ||
      contato?.emailNFe ||
      contato?.emailPrincipal,
  );
  if (direct) return direct;

  const emails = contato?.emails;
  if (Array.isArray(emails) && emails.length > 0) {
    const first = safeString(emails[0]?.email || emails[0]?.endereco || emails[0]?.value);
    if (first) return first;
  }

  return "";
}

function isAdvecName(name: string): boolean {
  const n = normalizeText(name);
  return n.includes("advec") || n.includes("assembleia de deus vitoria em cristo");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: blingConfig, error: configError } = await supabase
      .from("bling_config")
      .select("*")
      .single();

    if (configError || !blingConfig) {
      throw new Error("Configuração do Bling não encontrada");
    }

    let accessToken = blingConfig.access_token;
    if (isTokenExpired(blingConfig.token_expires_at)) {
      accessToken = await refreshBlingToken(supabase, blingConfig);
    }

    const unique = new Set<string>();
    const limit = 100;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://www.bling.com.br/Api/v3/contatos?pagina=${page}&limite=${limit}`;

      if (page > 1) await delay(400);

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (resp.status === 401) {
        accessToken = await refreshBlingToken(supabase, blingConfig);
        continue;
      }

      if (resp.status === 429) {
        await delay(2000);
        continue;
      }

      const json = await resp.json();
      if (!resp.ok) {
        console.error("Erro ao listar contatos:", resp.status, JSON.stringify(json));
        throw new Error(`Erro ao listar contatos do Bling: ${resp.status}`);
      }

      const contatos = (json?.data || []) as any[];
      for (const c of contatos) {
        const name = extractContactName(c);
        if (!name) continue;
        if (!isAdvecName(name)) continue;

        const email = extractEmail(c);
        const key = safeString(email).toLowerCase() || safeString(c?.id) || normalizeText(name);
        if (key) unique.add(key);
      }

      hasMore = contatos.length === limit;
      page++;

      if (page > 200) {
        console.log("Limite de páginas atingido (200)");
        break;
      }
    }

    return new Response(
      JSON.stringify({ totalAdvec: unique.size }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Erro em bling-advec-total:", error);
    return new Response(
      JSON.stringify({ error: (error as any)?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
