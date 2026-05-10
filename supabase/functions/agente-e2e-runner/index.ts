import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any = {};
  try { body = await req.json(); } catch {}
  const tests: Array<{ telefone: string; mensagem_user: string; label: string }> = body.tests || [];

  const results: any[] = [];
  for (const t of tests) {
    const t0 = Date.now();
    let status = 0;
    let json: any = null;
    let errText: string | null = null;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/agente-loja-cg`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ telefone: t.telefone, mensagem_user: t.mensagem_user }),
      });
      status = r.status;
      const text = await r.text();
      try { json = JSON.parse(text); } catch { errText = text; }
    } catch (e: any) {
      errText = e?.message || String(e);
    }
    results.push({
      label: t.label,
      telefone: t.telefone,
      mensagem_user: t.mensagem_user,
      http_status: status,
      elapsed_ms: Date.now() - t0,
      response_json: json,
      error_text: errText,
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
