import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/agente-loja-cg";
  const t0 = Date.now();
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, elapsed_ms: Date.now() - t0, body: text }), {
    headers: { "Content-Type": "application/json" },
  });
});
