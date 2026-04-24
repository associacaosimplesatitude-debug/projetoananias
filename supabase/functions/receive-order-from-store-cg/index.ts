import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "x-webhook-secret, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const expectedSecret = Deno.env.get("STORE_CG_WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");

    if (!expectedSecret || providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const {
      order_id,
      order_number,
      status,
      payment_status,
      payment_method,
      customer = {},
      totals = {},
      tracking_code,
      tracking_url,
      shipping_address = {},
      stripe_payment_id,
      mp_payment_id,
      order_date,
      paid_at,
    } = payload || {};

    if (!order_id || order_number === undefined || order_number === null) {
      return new Response(
        JSON.stringify({ error: "order_id and order_number are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const row = {
      loja_order_id: order_id,
      loja_order_number: order_number,
      status_pagamento: payment_status ?? "pending",
      status_pedido: status ?? "pending",
      payment_method: payment_method ?? null,
      customer_email: customer.email ?? null,
      customer_name: customer.name ?? null,
      customer_phone: customer.phone ?? null,
      customer_document: customer.document ?? null,
      valor_total: totals.total ?? 0,
      valor_subtotal: totals.subtotal ?? 0,
      valor_frete: totals.shipping ?? 0,
      valor_desconto: totals.discount ?? 0,
      codigo_rastreio: tracking_code ?? null,
      url_rastreio: tracking_url ?? null,
      endereco_rua: shipping_address.street ?? null,
      endereco_numero: shipping_address.number ?? null,
      endereco_complemento: shipping_address.complement ?? null,
      endereco_bairro: shipping_address.neighborhood ?? null,
      endereco_cidade: shipping_address.city ?? null,
      endereco_estado: shipping_address.state ?? null,
      endereco_cep: shipping_address.zip ?? null,
      endereco_nome: shipping_address.name ?? null,
      endereco_telefone: shipping_address.phone ?? null,
      stripe_payment_id: stripe_payment_id ?? null,
      mp_payment_id: mp_payment_id ?? null,
      order_date: order_date ?? null,
      paid_at: paid_at ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("ebd_loja_pedidos_cg")
      .upsert(row, { onConflict: "loja_order_id" })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("receive-order-from-store-cg error:", err, (err as Error)?.stack);
    return new Response(
      JSON.stringify({ error: (err as Error).message ?? "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
