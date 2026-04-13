import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const CONNECTED_ACCOUNT = Deno.env.get("STRIPE_CONNECTED_ACCOUNT");

    const { amount, description, test_mode } = await req.json();

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "amount é obrigatório e deve ser > 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = Math.round(amount * 100);
    const feeAmount = Math.round(amountCents * 0.03);
    const netAmount = amountCents - feeAmount;

    const params = new URLSearchParams();
    params.append("amount", amountCents.toString());
    params.append("currency", "brl");
    params.append("metadata[origem]", "teste_admin");
    params.append("metadata[descricao]", description || "Teste Stripe");
    if (test_mode) {
      params.append("metadata[test_mode]", "true");
    }

    if (CONNECTED_ACCOUNT) {
      params.append("application_fee_amount", feeAmount.toString());
      params.append("transfer_data[destination]", CONNECTED_ACCOUNT);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      return new Response(
        JSON.stringify({ error: stripeData.error?.message || "Erro Stripe", details: stripeData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        client_secret: stripeData.client_secret,
        payment_intent_id: stripeData.id,
        amount: amount,
        amount_cents: amountCents,
        fee_amount: feeAmount / 100,
        net_amount: netAmount / 100,
        status: stripeData.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
