// DEPRECATED 2026-05-07 — Shopify foi cancelada em 04/2026.
// Esta função foi desativada. Loja atual: ebd_loja_pedidos_cg
// (receive-order-from-store-cg, mp-create-order-and-pay, stripe-*).
// Arquivo mantido como tombstone para evitar 404 em callers desconhecidos.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "function_deprecated",
      message: "Esta função foi desativada após o cancelamento do Shopify (abr/2026). Use a infraestrutura da nova loja CG.",
      deprecated_at: "2026-05-07",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
