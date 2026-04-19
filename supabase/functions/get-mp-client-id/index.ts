// Returns the public Mercado Pago OAuth client_id from server-side secret.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientId = Deno.env.get("MP_CLIENT_ID") ?? null;
  console.log("[get-mp-client-id] len=", (Deno.env.get("MP_CLIENT_ID") ?? "").length);
  return new Response(JSON.stringify({ client_id: clientId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
