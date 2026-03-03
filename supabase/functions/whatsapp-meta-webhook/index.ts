// Legacy endpoint - forwards all requests to whatsapp-webhook for unified handling
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function getVerifyToken(): Promise<string> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "whatsapp_verify_token")
      .maybeSingle();
    if (data?.value) return data.value;
  } catch { /* ignore */ }
  return "centralgospel123";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET - Meta verification challenge
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge) {
      const expectedToken = await getVerifyToken();
      if (token === expectedToken) {
        console.log("[whatsapp-meta-webhook] Verification OK (legacy endpoint)");
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
      console.log("[whatsapp-meta-webhook] Verification FAILED");
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
  }

  // POST - Forward to main webhook handler via internal call
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[whatsapp-meta-webhook] Forwarding to main handler");

      // Call the main whatsapp-webhook function
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify(body),
      });

      const result = await res.json().catch(() => ({ success: true }));

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      console.error("[whatsapp-meta-webhook] Error:", err);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
