import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { revista_id } = await req.json();

    if (!revista_id) {
      return new Response(
        JSON.stringify({ error: "revista_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("revista_ranking_publico")
      .select("nome_comprador, total_pontos, total_quizzes")
      .eq("revista_id", revista_id)
      .order("total_pontos", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Erro ao buscar ranking:", error);
      return new Response(JSON.stringify({ ranking: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ranking = (data || []).map((item: any, i: number) => ({
      posicao: i + 1,
      nome: item.nome_comprador || "Leitor",
      total_pontos: item.total_pontos,
      total_quizzes: item.total_quizzes,
    }));

    return new Response(JSON.stringify({ ranking }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
