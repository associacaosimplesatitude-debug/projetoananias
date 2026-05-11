// Temporary E2E runner — calls agente-loja-cg using service role internally.
// Delete after validation.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { telefone, mensagens } = await req.json() as { telefone: string; mensagens: string[] };
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const URL = Deno.env.get("SUPABASE_URL")!;
    const out: any[] = [];
    for (const m of mensagens) {
      const t0 = Date.now();
      const r = await fetch(`${URL}/functions/v1/agente-loja-cg`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ telefone, mensagem_user: m }),
      });
      const text = await r.text();
      let body: any = text;
      try { body = JSON.parse(text); } catch {}
      out.push({ user: m, status: r.status, elapsed_ms: Date.now() - t0, response: body });
      // pequeno delay entre turnos
      await new Promise((res) => setTimeout(res, 500));
    }
    return new Response(JSON.stringify({ ok: true, turnos: out }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
