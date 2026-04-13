import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  const parts = sigHeader.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const signatures = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.split("=")[1]);

  if (!timestamp || signatures.length === 0) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload)
  );
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatures.includes(expected);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature") || "";

    if (WEBHOOK_SECRET && sigHeader) {
      const valid = await verifyStripeSignature(body, sigHeader, WEBHOOK_SECRET);
      if (!valid) {
        console.error("Stripe webhook signature inválida");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const event = JSON.parse(body);
    console.log("Stripe webhook event:", event.type, event.id);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let status = "DESCONHECIDO";
    let paymentIntentId = "";
    let amount = 0;
    let feeAmount = 0;
    let netAmount = 0;
    let description = "";

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      status = "PAGO";
      paymentIntentId = pi.id;
      amount = (pi.amount || 0) / 100;
      feeAmount = (pi.application_fee_amount || Math.round(pi.amount * 0.03)) / 100;
      netAmount = amount - feeAmount;
      description = pi.metadata?.descricao || "";
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      status = "FALHOU";
      paymentIntentId = pi.id;
      amount = (pi.amount || 0) / 100;
      feeAmount = (pi.application_fee_amount || Math.round(pi.amount * 0.03)) / 100;
      netAmount = amount - feeAmount;
      description = pi.metadata?.descricao || "";
    } else if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      status = "SESSAO_CONCLUIDA";
      paymentIntentId = session.payment_intent || session.id;
      amount = (session.amount_total || 0) / 100;
      feeAmount = Math.round(amount * 0.03 * 100) / 100;
      netAmount = amount - feeAmount;
      description = session.metadata?.descricao || "";
    } else {
      // Log other events but don't process
      console.log("Evento não processado:", event.type);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase.from("stripe_test_logs").insert({
      payment_intent_id: paymentIntentId,
      amount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      status,
      description,
      stripe_event: event.type,
      raw_payload: event,
    });

    if (error) {
      console.error("Erro ao salvar log:", error);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
