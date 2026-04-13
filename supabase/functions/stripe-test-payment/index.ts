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

    const body = await req.json();
    const { action } = body;

    // ── CREATE PIX ──
    if (action === "create_pix") {
      const { payment_intent_id } = body;
      if (!payment_intent_id) {
        return new Response(
          JSON.stringify({ error: "payment_intent_id é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const confirmRes = await fetch(
        `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            "payment_method_data[type]": "pix",
            "payment_method_options[pix][expires_after_seconds]": "3600",
          }).toString(),
        }
      );
      const confirmData = await confirmRes.json();

      if (!confirmRes.ok) {
        return new Response(
          JSON.stringify({ error: confirmData.error?.message || "Erro ao confirmar PIX", details: confirmData }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          qr_code: confirmData.next_action?.pix_display_qr_code?.image_url_png,
          qr_code_text: confirmData.next_action?.pix_display_qr_code?.data,
          expires_at: confirmData.next_action?.pix_display_qr_code?.expires_at,
          status: confirmData.status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CREATE PAYMENT INTENT (default) ──
    const { amount, description, test_mode } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "amount é obrigatório e deve ser > 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountCents = Math.round(amount * 100);
    const feeCents = Math.round(amountCents * 0.03);
    const netCents = amountCents - feeCents;

    const piParams = new URLSearchParams();
    piParams.append("amount", amountCents.toString());
    piParams.append("currency", "brl");
    piParams.append("payment_method_types[]", "pix");
    piParams.append("metadata[origem]", "teste_admin");
    piParams.append("metadata[descricao]", description || "Teste Stripe");
    piParams.append("metadata[transfer_destination]", "acct_1TJE3cKCVupxwxRr");
    piParams.append("metadata[fee_percent]", "3");
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

    return new Response(
      JSON.stringify({
        payment_intent_id: stripeData.id,
        client_secret: stripeData.client_secret,
        amount: amount,
        fee_amount: feeCents / 100,
        net_amount: netCents / 100,
        status: "aguardando_pagamento",
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
