import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { licao_id, pagina } = await req.json();

    if (!licao_id) {
      return new Response(
        JSON.stringify({ error: "licao_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If pagina is provided, return refs for that specific page
    if (pagina !== undefined && pagina !== null) {
      const { data, error } = await supabase
        .from("revista_referencias_pagina")
        .select("pagina, referencias")
        .eq("licao_id", licao_id)
        .eq("pagina", pagina)
        .maybeSingle();

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ referencias: data?.referencias || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Otherwise return all pages with refs for this lesson
    const { data, error } = await supabase
      .from("revista_referencias_pagina")
      .select("pagina, referencias")
      .eq("licao_id", licao_id)
      .order("pagina", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ paginas: data || [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
