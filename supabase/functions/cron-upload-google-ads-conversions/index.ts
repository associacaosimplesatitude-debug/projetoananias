import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Retorna a data "ontem" (YYYY-MM-DD) no fuso America/Sao_Paulo (UTC-3 fixo)
function yesterdaySP(): string {
  const nowUtcMs = Date.now();
  const spNow = new Date(nowUtcMs - 3 * 60 * 60 * 1000);
  // ontem
  spNow.setUTCDate(spNow.getUTCDate() - 1);
  const yyyy = spNow.getUTCFullYear();
  const mm = String(spNow.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(spNow.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const yesterday = yesterdaySP();
    const payload = {
      start_date: yesterday,
      end_date: yesterday,
      canal: "ambos",
      validate_only: false,
    };

    const url = `${supabaseUrl}/functions/v1/upload-google-ads-conversions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "x-trigger-source": "cron",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let inner: any = {};
    try {
      inner = text ? JSON.parse(text) : {};
    } catch {
      inner = { raw: text };
    }

    const summary = {
      period: yesterday,
      called: "upload-google-ads-conversions",
      status: res.status,
      ok: res.ok,
      enviados: inner?.enviados_ao_google ?? null,
      aceitos: inner?.aceitos_pelo_google ?? null,
      erros: Array.isArray(inner?.erros_partial_failure)
        ? inner.erros_partial_failure.length
        : null,
      response: inner,
    };

    return new Response(JSON.stringify(summary), {
      status: res.ok ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("cron-upload-google-ads-conversions error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
