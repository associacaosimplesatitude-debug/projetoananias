import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SHOPIFY_ACCESS_TOKEN = Deno.env.get("SHOPIFY_ADMIN_ACCESS_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SHOPIFY_STORE_DOMAIN = "kgg1pq-6r.myshopify.com";
    
    if (!SHOPIFY_ACCESS_TOKEN) {
      throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN not configured");
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/ebd-shopify-order-webhook`;
    
    console.log("Registering webhook for orders/paid to:", webhookUrl);

    // First, check existing webhooks
    const listResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/webhooks.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error("Failed to list webhooks:", listResponse.status, errorText);
      throw new Error(`Failed to list webhooks: ${listResponse.status}`);
    }

    const existingWebhooks = await listResponse.json();
    console.log("Existing webhooks:", JSON.stringify(existingWebhooks.webhooks?.map((w: any) => ({ id: w.id, topic: w.topic, address: w.address }))));

    // Check if webhook already exists for orders/paid
    const existingOrderPaidWebhook = existingWebhooks.webhooks?.find(
      (w: any) => w.topic === "orders/paid" && w.address.includes("ebd-shopify-order-webhook")
    );

    if (existingOrderPaidWebhook) {
      console.log("Webhook already exists:", existingOrderPaidWebhook.id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Webhook already configured",
          webhook_id: existingOrderPaidWebhook.id,
          address: existingOrderPaidWebhook.address
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create new webhook for orders/paid
    const createResponse = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/webhooks.json`,
      {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhook: {
            topic: "orders/paid",
            address: webhookUrl,
            format: "json",
          },
        }),
      }
    );

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Failed to create webhook:", createResponse.status, errorText);
      throw new Error(`Failed to create webhook: ${createResponse.status} - ${errorText}`);
    }

    const newWebhook = await createResponse.json();
    console.log("Webhook created successfully:", newWebhook.webhook?.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook registered successfully",
        webhook_id: newWebhook.webhook?.id,
        topic: "orders/paid",
        address: webhookUrl
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error registering webhook:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
