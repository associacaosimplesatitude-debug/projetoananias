import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const body = await req.json();
    const tests: Array<{ telefone: string; mensagem_user: string }> = body.tests || [];
    const results: any[] = [];
    for (const t of tests) {
      const t0 = Date.now();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/agente-loja-cg`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(t),
      });
      const elapsed = Date.now() - t0;
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch (_) { parsed = { raw: text }; }
      results.push({ input: t, status: r.status, elapsed_ms: elapsed, body: parsed });
      // Sleep entre testes pra evitar rate limit
      await new Promise((res) => setTimeout(res, 8000));
    }
    return new Response(JSON.stringify({ results }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
