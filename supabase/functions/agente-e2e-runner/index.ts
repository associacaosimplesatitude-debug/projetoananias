import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const url = "https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/agente-loja-cg";
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      telefone: "11949910738",
      mensagem_user: "Oi",
    }),
  });
  const elapsed = Date.now() - t0;
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, elapsed_ms: elapsed, body: text }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
});
