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

    const transferDestination = Deno.env.get("STRIPE_TRANSFER_DESTINATION");

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

    // 1. Criar PaymentIntent na conta da Central Gospel
    const piParams = new URLSearchParams();
    piParams.append("amount", amountCents.toString());
    piParams.append("currency", "brl");
    piParams.append("metadata[origem]", "teste_admin");
    piParams.append("metadata[descricao]", description || "Teste Stripe");
    if (test_mode) {
      piParams.append("metadata[test_mode]", "true");
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: piParams.toString(),
    });

    const stripeData = await stripeRes.json();

    if (!stripeRes.ok) {
      return new Response(
        JSON.stringify({ error: stripeData.error?.message || "Erro Stripe", details: stripeData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Transferir 3% para House Comunicação via Transfer API
    let transferId = null;
    if (transferDestination && feeAmount > 0) {
      const trParams = new URLSearchParams();
      trParams.append("amount", feeAmount.toString());
      trParams.append("currency", "brl");
      trParams.append("destination", transferDestination);
      trParams.append("transfer_group", stripeData.id);
      trParams.append("metadata[origem]", "taxa_house_3pct");
      trParams.append("metadata[payment_intent]", stripeData.id);

      const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: trParams.toString(),
      });

      const transferData = await transferRes.json();

      if (!transferRes.ok) {
        // Retorna o PI criado mas avisa que a transfer falhou
        return new Response(
          JSON.stringify({
            payment_intent_id: stripeData.id,
            client_secret: stripeData.client_secret,
            amount: amount,
            fee_amount: feeAmount / 100,
            net_amount: netAmount / 100,
            transfer_error: transferData.error?.message || "Erro na transferência",
            status: stripeData.status,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      transferId = transferData.id;
    }

    return new Response(
      JSON.stringify({
        client_secret: stripeData.client_secret,
        payment_intent_id: stripeData.id,
        transfer_id: transferId,
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
