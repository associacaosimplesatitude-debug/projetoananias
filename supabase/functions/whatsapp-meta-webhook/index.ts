// DEPRECATED: This function is inactive (404) due to edge function limit.
// The Meta webhook is now handled inside whatsapp-webhook.
// Keeping this file for reference only.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET - Webhook verification (Meta challenge)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === "MEU_VERIFY_TOKEN_123") {
      console.log("[whatsapp-meta-webhook] Verification OK");
      return new Response(challenge, { status: 200, headers: corsHeaders });
    }

    console.log("[whatsapp-meta-webhook] Verification FAILED", { mode, token });
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // POST - Receive events
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("[whatsapp-meta-webhook] Event received:", JSON.stringify(body));

      // Save to whatsapp_webhooks for auditing
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      const telefone = message?.from || body?.entry?.[0]?.changes?.[0]?.value?.metadata?.display_phone_number || null;
      const messageId = message?.id || null;
      const evento = body?.entry?.[0]?.changes?.[0]?.field || "meta_webhook";

      await supabase.from("whatsapp_webhooks").insert({
        evento,
        telefone,
        message_id: messageId,
        payload: body,
      });

      return new Response(JSON.stringify({ success: true }), {
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
