// Returns the Mercado Pago public_key of the connected seller account.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("mp_connected_accounts")
      .select("public_key, collector_id, live_mode, updated_at")
      .not("public_key", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[get-mp-public-key] db error:", error.message);
      return new Response(JSON.stringify({ error: "db_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data?.public_key) {
      console.warn("[get-mp-public-key] no connected seller with public_key");
      return new Response(
        JSON.stringify({ error: "no_connected_seller" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(
      "[get-mp-public-key] returning pk for collector_id:",
      data.collector_id,
      "live_mode:",
      data.live_mode,
    );

    return new Response(
      JSON.stringify({
        public_key: data.public_key,
        collector_id: data.collector_id,
        live_mode: data.live_mode,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[get-mp-public-key] exception:", e);
    return new Response(JSON.stringify({ error: "exception" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
