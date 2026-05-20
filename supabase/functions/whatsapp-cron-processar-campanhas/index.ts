// Cron processor for WhatsApp mass-broadcast campaigns
// Runs every 5 minutes via pg_cron → invokes this function with service-role auth.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_CAMPANHAS_POR_RODADA = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const log = (msg: string, extra?: unknown) =>
    console.log(`[cron-processar-campanhas] ${msg}${extra ? " " + JSON.stringify(extra) : ""}`);

  try {
    // Step A: materialize scheduled campaigns whose time has come
    const nowIso = new Date().toISOString();
    const { data: agendadas } = await supabase
      .from("whatsapp_campanhas")
      .select("id, nome, agendada_para")
      .eq("status", "agendada")
      .lte("agendada_para", nowIso)
      .limit(MAX_CAMPANHAS_POR_RODADA);

    for (const c of agendadas || []) {
      log("materializando", { id: c.id, nome: c.nome });
      await supabase.from("whatsapp_campanhas")
        .update({ status: "materializando" }).eq("id", c.id);
      const { data: inserted, error: matErr } = await supabase.rpc(
        "whatsapp_campanha_materializar",
        { p_campanha_id: c.id }
      );
      if (matErr) {
        log("ERRO materializar", { id: c.id, err: matErr.message });
        await supabase.from("whatsapp_campanhas")
          .update({ status: "erro" }).eq("id", c.id);
      } else {
        log("materializado", { id: c.id, total: inserted });
      }
    }

    // Step B: quiet hours guard
    const { data: dentroData } = await supabase.rpc("whatsapp_dentro_quiet_hours");
    const dentro = dentroData === true;
    if (!dentro) {
      log("fora da janela permitida — só materializou nesta rodada");
      return new Response(
        JSON.stringify({ ok: true, materializadas: (agendadas || []).length, fora_quiet_hours: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step C: promote "pronta" → "processando"
    const { data: prontas } = await supabase
      .from("whatsapp_campanhas")
      .select("id, nome")
      .eq("status", "pronta")
      .order("created_at", { ascending: true })
      .limit(MAX_CAMPANHAS_POR_RODADA);
    for (const c of prontas || []) {
      log("promovendo para processando", { id: c.id, nome: c.nome });
      await supabase.from("whatsapp_campanhas")
        .update({ status: "processando", iniciada_em: new Date().toISOString() })
        .eq("id", c.id);
    }

    // Step D + E: process up to MAX 'processando' campaigns
    const { data: processando } = await supabase
      .from("whatsapp_campanhas")
      .select("id, nome")
      .eq("status", "processando")
      .order("iniciada_em", { ascending: true })
      .limit(MAX_CAMPANHAS_POR_RODADA);

    const results: any[] = [];
    for (const c of processando || []) {
      // Check pending
      const { count: pendentes } = await supabase
        .from("whatsapp_campanha_destinatarios")
        .select("*", { count: "exact", head: true })
        .eq("campanha_id", c.id)
        .eq("status_envio", "pendente");

      if ((pendentes || 0) === 0) {
        log("concluindo (sem pendentes)", { id: c.id });
        await supabase.from("whatsapp_campanhas")
          .update({ status: "concluida", finalizada_em: new Date().toISOString() })
          .eq("id", c.id);
        results.push({ id: c.id, concluida: true });
        continue;
      }

      log("invocando send-campaign", { id: c.id, pendentes });
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-campaign`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
            apikey: anonKey,
          },
          body: JSON.stringify({ campanha_id: c.id }),
        });
        const body = await res.text();
        results.push({ id: c.id, status: res.status, body: body.slice(0, 200) });
      } catch (e: any) {
        log("ERRO send-campaign", { id: c.id, err: e.message });
        results.push({ id: c.id, error: e.message });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        materializadas: (agendadas || []).length,
        promovidas: (prontas || []).length,
        processadas: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[cron-processar-campanhas] erro geral", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
