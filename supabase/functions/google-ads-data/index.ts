import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function getAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token error: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function getCredentials(supabase: ReturnType<typeof createClient>) {
  const keys = [
    "google_ads_developer_token",
    "google_ads_client_id",
    "google_ads_client_secret",
    "google_ads_refresh_token",
    "google_ads_customer_id",
  ];
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value")
    .in("key", keys);
  if (error) throw new Error("Failed to load credentials");
  const map: Record<string, string> = {};
  (data || []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value; });
  
  for (const k of keys) {
    if (!map[k]) throw new Error(`Missing credential: ${k}`);
  }
  return map;
}

async function queryGoogleAds(
  accessToken: string,
  developerToken: string,
  customerId: string,
  query: string
) {
  const cid = customerId.replace(/-/g, "");
  const url = `https://googleads.googleapis.com/v23/customers/${cid}/googleAds:searchStream`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Ads API error: ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify user token
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, start, end, year, month } = body;

    const creds = await getCredentials(supabase);
    const accessToken = await getAccessToken(
      creds.google_ads_refresh_token,
      creds.google_ads_client_id,
      creds.google_ads_client_secret
    );
    const customerId = creds.google_ads_customer_id.replace(/-/g, "");
    const devToken = creds.google_ads_developer_token;

    let result: unknown;

    if (action === "metrics") {
      const startDate = start || "2024-01-01";
      const endDate = end || new Date().toISOString().split("T")[0];
      const query = `
        SELECT 
          metrics.conversions_value,
          metrics.clicks,
          metrics.average_cpc,
          metrics.cost_micros,
          metrics.conversions,
          metrics.impressions
        FROM customer
        WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      `;
      const raw = await queryGoogleAds(accessToken, devToken, customerId, query);
      // Parse stream response
      const rows = raw?.[0]?.results || [];
      let totalConversionsValue = 0;
      let totalClicks = 0;
      let totalCostMicros = 0;
      let totalImpressions = 0;
      let totalConversions = 0;
      let cpcSum = 0;
      let cpcCount = 0;

      for (const row of rows) {
        const m = row.metrics || {};
        totalConversionsValue += parseFloat(m.conversionsValue || "0");
        totalClicks += parseInt(m.clicks || "0", 10);
        totalCostMicros += parseInt(m.costMicros || "0", 10);
        totalImpressions += parseInt(m.impressions || "0", 10);
        totalConversions += parseFloat(m.conversions || "0");
        if (m.averageCpc) {
          cpcSum += parseInt(m.averageCpc || "0", 10);
          cpcCount++;
        }
      }

      result = {
        conversions_value: totalConversionsValue,
        clicks: totalClicks,
        cost: totalCostMicros / 1_000_000,
        impressions: totalImpressions,
        conversions: totalConversions,
        average_cpc: cpcCount > 0 ? (cpcSum / cpcCount) / 1_000_000 : 0,
      };
    } else if (action === "balance") {
      // Get account budget info
      const query = `
        SELECT 
          account_budget.amount_served_micros,
          account_budget.approved_spending_limit_micros,
          account_budget.status
        FROM account_budget
        WHERE account_budget.status = 'APPROVED'
        ORDER BY account_budget.id DESC
        LIMIT 1
      `;
      try {
        const raw = await queryGoogleAds(accessToken, devToken, customerId, query);
        const rows = raw?.[0]?.results || [];
        if (rows.length > 0) {
          const budget = rows[0].accountBudget || {};
          const approvedMicros = parseInt(budget.approvedSpendingLimitMicros || "0", 10);
          const servedMicros = parseInt(budget.amountServedMicros || "0", 10);
          result = {
            approved_limit: approvedMicros / 1_000_000,
            amount_served: servedMicros / 1_000_000,
            remaining: (approvedMicros - servedMicros) / 1_000_000,
            status: budget.status || "UNKNOWN",
          };
        } else {
          result = { approved_limit: 0, amount_served: 0, remaining: 0, status: "NO_BUDGET" };
        }
      } catch {
        result = { approved_limit: 0, amount_served: 0, remaining: 0, status: "UNAVAILABLE" };
      }
    } else if (action === "invoices") {
      // Get billing setup first, then invoices
      const y = year || new Date().getFullYear().toString();
      const m2 = month || (new Date().getMonth() + 1).toString().padStart(2, "0");
      
      // List billing setups
      const bsQuery = `SELECT billing_setup.id, billing_setup.status FROM billing_setup WHERE billing_setup.status = 'APPROVED' LIMIT 1`;
      try {
        const bsRaw = await queryGoogleAds(accessToken, devToken, customerId, bsQuery);
        const bsRows = bsRaw?.[0]?.results || [];
        
        if (bsRows.length > 0) {
          const billingSetupId = bsRows[0].billingSetup?.id;
          // Fetch invoices via REST
          const invoiceUrl = `https://googleads.googleapis.com/v23/customers/${customerId}/invoices?billingSetup=customers/${customerId}/billingSetups/${billingSetupId}&issueYear=${y}&issueMonth=${getMonthEnum(m2)}`;
          const invoiceRes = await fetch(invoiceUrl, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "developer-token": devToken,
            },
          });
          if (invoiceRes.ok) {
            const invoiceData = await invoiceRes.json();
            result = (invoiceData.invoices || []).map((inv: Record<string, unknown>) => ({
              id: inv.id,
              type: inv.type,
              issue_date: inv.issueDate,
              due_date: inv.dueDate,
              subtotal: parseInt(String(inv.subtotalAmountMicros || "0"), 10) / 1_000_000,
              total: parseInt(String(inv.totalAmountMicros || "0"), 10) / 1_000_000,
              pdf_url: inv.pdfUrl || null,
            }));
          } else {
            result = [];
          }
        } else {
          result = [];
        }
      } catch {
        result = [];
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function getMonthEnum(month: string): string {
  const months: Record<string, string> = {
    "01": "JANUARY", "02": "FEBRUARY", "03": "MARCH", "04": "APRIL",
    "05": "MAY", "06": "JUNE", "07": "JULY", "08": "AUGUST",
    "09": "SEPTEMBER", "10": "OCTOBER", "11": "NOVEMBER", "12": "DECEMBER",
  };
  return months[month] || "JANUARY";
}
