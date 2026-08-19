import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GRAPH = "https://graph.facebook.com/v21.0";

interface MetaAdsCredentials {
  access_token: string;
  ad_account_id: string;
  business_id?: string;
}

async function getCredentials(supabaseClient: any): Promise<MetaAdsCredentials> {
  const keys = ["meta_ads_access_token", "meta_ads_ad_account_id", "meta_ads_business_id"];

  const { data, error } = await supabaseClient
    .from("system_settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw new Error(`Erro ao buscar credenciais: ${error.message}`);

  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    settings[row.key] = row.value;
  });

  if (!settings.meta_ads_access_token || !settings.meta_ads_ad_account_id) {
    throw new Error("Credenciais do Meta Ads incompletas. Configure o access token e o ID da conta de anúncios.");
  }

  return {
    access_token: settings.meta_ads_access_token,
    ad_account_id: settings.meta_ads_ad_account_id.replace(/^act_/, ""),
    business_id: settings.meta_ads_business_id || undefined,
  };
}

function friendlyError(err: any): string {
  const message: string = err?.message || "Erro desconhecido na API do Meta";
  const code = err?.code;
  const lower = message.toLowerCase();

  if (code === 190 || lower.includes("access token")) {
    return "Token de acesso do Meta inválido ou expirado. Atualize o token nas configurações.";
  }
  if (lower.includes("permission") || lower.includes("ads_read") || code === 200 || code === 10) {
    return "Sem permissão para ler os anúncios (é necessária a permissão ads_read no token do Meta).";
  }
  if (lower.includes("unsupported get request") || lower.includes("does not exist") || code === 803) {
    return "Conta de anúncios não encontrada. Verifique o ID da conta configurado.";
  }
  return message;
}

async function metaFetch(url: string) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));

  if (!res.ok || body?.error) {
    console.error("Meta API error:", res.status, JSON.stringify(body?.error || body));
    throw new Error(friendlyError(body?.error));
  }
  return body;
}

function pickPurchase(list: any[] | undefined): number {
  if (!Array.isArray(list)) return 0;
  const match = list.find((a) => String(a.action_type || "").includes("purchase"));
  return match ? Number(match.value || 0) : 0;
}

function translateStatus(status?: string, effectiveStatus?: string): string {
  const eff = effectiveStatus || status;
  switch (eff) {
    case "ACTIVE": return "Ativo";
    case "PAUSED": return "Pausado";
    case "ARCHIVED": return "Arquivado";
    case "DELETED": return "Excluído";
    case "CAMPAIGN_PAUSED": return "Pausado";
    case "IN_PROCESS":
    case "PENDING_REVIEW":
    case "PREAPPROVED":
    case "WITH_ISSUES":
    case "DISAPPROVED":
    case "PENDING_BILLING_INFO":
      return "Em rascunho";
    default:
      return eff || "—";
  }
}

async function handleCampaigns(creds: MetaAdsCredentials, period: string, startDate?: string, endDate?: string) {
  const insightsRange = period === "all"
    ? `insights.date_preset(maximum)`
    : `insights.time_range({"since":"${startDate}","until":"${endDate}"})`;

  const fields = `name,status,effective_status,daily_budget,lifetime_budget,objective,${insightsRange}{spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type}`;

  const url = `${GRAPH}/act_${creds.ad_account_id}/campaigns?fields=${encodeURIComponent(fields)}&limit=50&access_token=${encodeURIComponent(creds.access_token)}`;

  const body = await metaFetch(url);
  const rows = body?.data || [];

  const campaigns = rows.map((c: any) => {
    const ins = c.insights?.data?.[0] || {};
    const spend = Number(ins.spend || 0);
    const impressions = Number(ins.impressions || 0);
    const clicks = Number(ins.clicks || 0);
    const results = pickPurchase(ins.actions);
    const costPerResultApi = pickPurchase(ins.cost_per_action_type);
    const costPerResult = costPerResultApi > 0
      ? costPerResultApi
      : (results > 0 ? spend / results : 0);

    return {
      id: c.id,
      name: c.name,
      status: translateStatus(c.status, c.effective_status),
      raw_status: c.status,
      effective_status: c.effective_status,
      objective: c.objective || null,
      daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
      spend,
      impressions,
      clicks,
      ctr: Number(ins.ctr || (impressions > 0 ? (clicks / impressions) * 100 : 0)),
      cpc: Number(ins.cpc || 0),
      results,
      cost_per_result: costPerResult,
    };
  });

  const totals = campaigns.reduce(
    (acc: any, c: any) => {
      acc.spend += c.spend;
      acc.impressions += c.impressions;
      acc.clicks += c.clicks;
      acc.results += c.results;
      return acc;
    },
    { spend: 0, impressions: 0, clicks: 0, results: 0 }
  );

  return {
    campaigns,
    summary: {
      spend: totals.spend,
      impressions: totals.impressions,
      clicks: totals.clicks,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      results: totals.results,
      cost_per_result: totals.results > 0 ? totals.spend / totals.results : 0,
    },
    account_id: creds.ad_account_id,
  };
}

async function handleValidate(creds: MetaAdsCredentials) {
  const url = `${GRAPH}/act_${creds.ad_account_id}?fields=name,account_status,currency&access_token=${encodeURIComponent(creds.access_token)}`;
  const body = await metaFetch(url);
  return { status: "connected", accountName: body?.name || "Conta conectada", currency: body?.currency };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, period, startDate, endDate } = await req.json();
    const creds = await getCredentials(supabaseAdmin);

    let result;
    switch (action) {
      case "validate":
        result = await handleValidate(creds);
        break;
      case "campaigns":
        if (period !== "all" && (!startDate || !endDate)) {
          throw new Error("startDate e endDate são obrigatórios");
        }
        result = await handleCampaigns(creds, period || "custom", startDate, endDate);
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("meta-ads-dashboard error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Erro interno" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
