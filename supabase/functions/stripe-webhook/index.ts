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

      // Gravar log do pagamento primeiro
      const { error: logError } = await supabase.from("stripe_test_logs").insert({
        payment_intent_id: paymentIntentId,
        amount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        status,
        description,
        stripe_event: event.type,
        raw_payload: event,
      });
      if (logError) console.error("Erro ao salvar log:", logError);

      // Executar transferência de 3% para House Comunicação
      const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
      const destination = Deno.env.get("STRIPE_CONNECTED_ACCOUNT") || "acct_1TLch2QtDc37RJKx";
      console.log("Transfer destination:", destination);
      const transferAmount = Math.round(pi.amount * 0.03);

      // Extrair source_transaction (obrigatório para transferências no Brasil)
      const sourceTransaction = typeof pi.latest_charge === 'string'
        ? pi.latest_charge
        : pi.charges?.data?.[0]?.id || null;
      console.log("Source transaction (charge):", sourceTransaction);

      if (!sourceTransaction) {
        console.error("Charge não encontrado no PaymentIntent, impossível criar transferência no Brasil");
        await supabase.from("stripe_test_logs").insert({
          payment_intent_id: pi.id,
          amount: pi.amount / 100,
          fee_amount: transferAmount / 100,
          net_amount: (pi.amount - transferAmount) / 100,
          status: "TRANSFERENCIA_FALHOU",
          stripe_event: "transfer.skipped",
          raw_payload: { error: "source_transaction not found", pi_keys: Object.keys(pi) },
        });
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transferParams = new URLSearchParams();
      transferParams.append("amount", transferAmount.toString());
      transferParams.append("currency", "brl");
      transferParams.append("destination", destination);
      transferParams.append("source_transaction", sourceTransaction);
      transferParams.append("transfer_group", pi.id);
      transferParams.append("metadata[origem]", "webhook_automatico");
      transferParams.append("metadata[payment_intent]", pi.id);

      const transferRes = await fetch("https://api.stripe.com/v1/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: transferParams.toString(),
      });

      const transferData = await transferRes.json();
      console.log("Transfer result:", transferRes.ok, JSON.stringify(transferData));

      // Gravar resultado da transferência em stripe_test_logs
      await supabase.from("stripe_test_logs").insert({
        payment_intent_id: pi.id,
        amount: pi.amount / 100,
        fee_amount: transferAmount / 100,
        net_amount: (pi.amount - transferAmount) / 100,
        status: transferRes.ok ? "TRANSFERENCIA_EXECUTADA" : "TRANSFERENCIA_FALHOU",
        stripe_event: "transfer.created",
        raw_payload: transferData,
      });

      // Retornar aqui pois já gravamos o log acima
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
