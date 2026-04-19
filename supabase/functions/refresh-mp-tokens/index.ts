// Proactive cron-driven MP OAuth token refresh.
// Refreshes any account whose access_token expires within 30 days.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshSellerToken } from "../_shared/mp-refresh.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Auth: require cron secret
  const provided = req.headers.get("x-cron-secret") ?? "";
  const expected = Deno.env.get("CRON_SECRET") ?? "";
  if (!expected || provided !== expected) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const threshold = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: accounts, error } = await supabaseAdmin
    .from("mp_connected_accounts")
    .select("collector_id, expires_at")
    .lt("expires_at", threshold);

  if (error) {
    console.error("[refresh-mp-tokens] failed to query accounts", error);
    return new Response(
      JSON.stringify({ error: "DB query failed", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const refreshed: string[] = [];
  const failed: { collector_id: string; error: string }[] = [];

  for (const acc of accounts ?? []) {
    const collectorId = (acc as { collector_id: string }).collector_id;
    try {
      const result = await refreshSellerToken(supabaseAdmin, collectorId);
      if (result) {
        refreshed.push(collectorId);
      } else {
        failed.push({ collector_id: collectorId, error: "refresh returned null" });
      }
    } catch (e) {
      failed.push({ collector_id: collectorId, error: String(e) });
    }
  }

  console.log("[refresh-mp-tokens] done", {
    processed: (accounts ?? []).length,
    refreshed: refreshed.length,
    failed: failed.length,
  });

  return new Response(
    JSON.stringify({
      processed: (accounts ?? []).length,
      refreshed,
      failed,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
