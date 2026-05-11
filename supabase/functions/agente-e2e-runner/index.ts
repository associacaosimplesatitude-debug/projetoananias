import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const URL = Deno.env.get("SUPABASE_URL")!;
  const { telefone, mensagens } = await req.json();
  const results: any[] = [];
  for (const m of mensagens) {
    const r = await fetch(`${URL}/functions/v1/agente-loja-cg`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE}` },
      body: JSON.stringify({ telefone, mensagem_user: m }),
    });
    const status = r.status;
    let body: any = null;
    try { body = await r.json(); } catch { body = await r.text(); }
    results.push({ msg: m, status, body });
    await new Promise((r) => setTimeout(r, 1500));
  }
  return new Response(JSON.stringify({ results }, null, 2), { headers: { "Content-Type": "application/json" } });
});
