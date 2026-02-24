import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GoogleAdsCredentials {
  developer_token: string;
  client_id: string;
  client_secret: string;
  refresh_token: string;
  customer_id: string;
  login_customer_id?: string;
}

async function getCredentials(supabaseClient: any): Promise<GoogleAdsCredentials> {
  const keys = [
    "google_ads_developer_token",
    "google_ads_client_id",
    "google_ads_client_secret",
    "google_ads_refresh_token",
    "google_ads_customer_id",
    "google_ads_login_customer_id",
  ];

  const { data, error } = await supabaseClient
    .from("system_settings")
    .select("key, value")
    .in("key", keys);

  if (error) throw new Error(`Erro ao buscar credenciais: ${error.message}`);

  const settings: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    settings[row.key] = row.value;
  });

  if (!settings.google_ads_developer_token || !settings.google_ads_client_id || !settings.google_ads_client_secret || !settings.google_ads_refresh_token || !settings.google_ads_customer_id) {
    throw new Error("Credenciais do Google Ads incompletas. Configure todas na tela de Integrações.");
  }

  return {
    developer_token: settings.google_ads_developer_token,
    client_id: settings.google_ads_client_id,
    client_secret: settings.google_ads_client_secret,
    refresh_token: settings.google_ads_refresh_token,
    customer_id: settings.google_ads_customer_id.replace(/-/g, ""),
    login_customer_id: settings.google_ads_login_customer_id?.replace(/-/g, "") || undefined,
  };
}

async function refreshAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      refresh_token: creds.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (data.error) {
    const msg = data.error === "unauthorized_client"
      ? "Client ID/Secret inválidos"
      : data.error_description || data.error;
    throw new Error(`Erro OAuth2: ${msg}`);
  }
  return data.access_token;
}

function buildHeaders(creds: GoogleAdsCredentials, accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": creds.developer_token,
    "Content-Type": "application/json",
  };
  if (creds.login_customer_id) {
    headers["login-customer-id"] = creds.login_customer_id;
  }
  return headers;
}

async function gaqlQuery(creds: GoogleAdsCredentials, accessToken: string, query: string) {
  const url = `https://googleads.googleapis.com/v23/customers/${creds.customer_id}/googleAds:searchStream`;
  const headers = buildHeaders(creds, accessToken);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("Google Ads API error:", res.status, errBody);

    if (res.status === 401) throw new Error("Token de acesso expirado ou inválido");
    if (res.status === 403) {
      if (errBody.includes("DEVELOPER_TOKEN")) throw new Error("Developer Token inválido ou não aprovado");
      throw new Error("Sem permissão para acessar esta conta");
    }
    throw new Error(`Erro na API Google Ads (${res.status}): ${errBody.substring(0, 200)}`);
  }

  return await res.json();
}

async function handleValidate(creds: GoogleAdsCredentials) {
  const accessToken = await refreshAccessToken(creds);
  const query = `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`;
  const result = await gaqlQuery(creds, accessToken, query);

  const customerName = result?.[0]?.results?.[0]?.customer?.descriptiveName || "Conta conectada";
  return { status: "connected", customerName };
}

async function handleMetrics(creds: GoogleAdsCredentials, startDate: string, endDate: string) {
  const accessToken = await refreshAccessToken(creds);
  const query = `
    SELECT
      metrics.conversions_value,
      metrics.clicks,
      metrics.average_cpc,
      metrics.cost_micros
    FROM customer
    WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
  `;

  const result = await gaqlQuery(creds, accessToken, query);
  const rows = result?.[0]?.results || [];

  let totalConversionsValue = 0;
  let totalClicks = 0;
  let totalCostMicros = 0;
  let totalCpcMicros = 0;
  let cpcCount = 0;

  for (const row of rows) {
    const m = row.metrics || {};
    totalConversionsValue += Number(m.conversionsValue || 0);
    totalClicks += Number(m.clicks || 0);
    totalCostMicros += Number(m.costMicros || 0);
    if (m.averageCpc) {
      totalCpcMicros += Number(m.averageCpc);
      cpcCount++;
    }
  }

  return {
    conversions_value: totalConversionsValue,
    clicks: totalClicks,
    average_cpc: cpcCount > 0 ? totalCpcMicros / cpcCount / 1_000_000 : 0,
    cost: totalCostMicros / 1_000_000,
  };
}

async function handleBilling(creds: GoogleAdsCredentials) {
  const accessToken = await refreshAccessToken(creds);

  const query = `
    SELECT
      billing_setup.id,
      billing_setup.status,
      billing_setup.payments_account
    FROM billing_setup
    WHERE billing_setup.status = 'APPROVED'
    LIMIT 1
  `;

  try {
    const result = await gaqlQuery(creds, accessToken, query);
    const setup = result?.[0]?.results?.[0]?.billingSetup || null;

    // Cost this month
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const costQuery = `
      SELECT metrics.cost_micros
      FROM customer
      WHERE segments.date BETWEEN '${startOfMonth}' AND '${today}'
    `;
    const costResult = await gaqlQuery(creds, accessToken, costQuery);
    const costRows = costResult?.[0]?.results || [];
    let monthCost = 0;
    for (const r of costRows) {
      monthCost += Number(r.metrics?.costMicros || 0);
    }

    return {
      billing_setup: setup,
      month_cost: monthCost / 1_000_000,
      customer_id: creds.customer_id,
    };
  } catch (e) {
    console.error("Billing error:", e);
    return {
      billing_setup: null,
      month_cost: 0,
      customer_id: creds.customer_id,
      error: e.message,
    };
  }
}

async function handleInvoices(creds: GoogleAdsCredentials, year: number, month: number) {
  const accessToken = await refreshAccessToken(creds);
  const headers = buildHeaders(creds, accessToken);

  // Try to get invoices via the AccountBudget or billing API
  const query = `
    SELECT
      account_budget.id,
      account_budget.name,
      account_budget.amount_micros,
      account_budget.status,
      account_budget.approved_start_date_time,
      account_budget.approved_end_date_time
    FROM account_budget
    ORDER BY account_budget.approved_start_date_time DESC
    LIMIT 50
  `;

  try {
    const result = await gaqlQuery(creds, accessToken, query);
    const budgets = result?.[0]?.results || [];

    return {
      invoices: budgets.map((b: any) => ({
        id: b.accountBudget?.id,
        name: b.accountBudget?.name || "Orçamento",
        amount: Number(b.accountBudget?.amountMicros || 0) / 1_000_000,
        status: b.accountBudget?.status,
        start_date: b.accountBudget?.approvedStartDateTime,
        end_date: b.accountBudget?.approvedEndDateTime,
      })),
      has_data: budgets.length > 0,
    };
  } catch (e) {
    console.error("Invoices error:", e);
    return { invoices: [], has_data: false, error: e.message };
  }
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

    // Validate user auth
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

    // Use service role to read system_settings
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { action, startDate, endDate, year, month } = await req.json();

    const creds = await getCredentials(supabaseAdmin);

    let result;
    switch (action) {
      case "validate":
        result = await handleValidate(creds);
        break;
      case "metrics":
        if (!startDate || !endDate) throw new Error("startDate e endDate são obrigatórios");
        result = await handleMetrics(creds, startDate, endDate);
        break;
      case "billing":
        result = await handleBilling(creds);
        break;
      case "invoices":
        result = await handleInvoices(creds, year || new Date().getFullYear(), month || new Date().getMonth() + 1);
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("google-ads-dashboard error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
