import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { slug, referrer, user_agent } = await req.json();

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "Slug is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Tracking click for slug: ${slug}`);

    // Find the affiliate link by slug
    const { data: affiliateLink, error: linkError } = await supabase
      .from("royalties_affiliate_links")
      .select("id")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (linkError || !affiliateLink) {
      console.error("Affiliate link not found:", linkError);
      return new Response(
        JSON.stringify({ error: "Affiliate link not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get IP from headers (anonymized - just last octet removed)
    const forwardedFor = req.headers.get("x-forwarded-for");
    const clientIp = forwardedFor?.split(",")[0]?.trim() || "unknown";
    const ipHash = clientIp.split(".").slice(0, 3).join(".") + ".x"; // Anonymize IP

    // Insert click record
    const { error: insertError } = await supabase
      .from("royalties_affiliate_clicks")
      .insert({
        affiliate_link_id: affiliateLink.id,
        ip_hash: ipHash,
        user_agent: user_agent || null,
        referrer: referrer || null,
      });

    if (insertError) {
      console.error("Error inserting click:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to track click" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Click tracked successfully for link: ${affiliateLink.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in track-affiliate-click:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
