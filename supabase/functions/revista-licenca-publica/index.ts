import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Consulta pública (por código exato) de uma licença de revista ativa.
// Executa com service role e devolve apenas os campos necessários à página de pagamento.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";

    if (!codigo || codigo.length < 6 || codigo.length > 100) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("get_licenca_by_codigo", { _codigo: codigo });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.status !== "ativa") {
      return new Response(JSON.stringify({ licenca: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ licenca: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("revista-licenca-publica error:", err);
    return new Response(JSON.stringify({ error: "Erro ao consultar licença" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
