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
    const { quiz_id, licao_id, whatsapp, respostas } = await req.json();

    if (!quiz_id || !licao_id || !whatsapp || !respostas) {
      return new Response(
        JSON.stringify({ error: "quiz_id, licao_id, whatsapp e respostas são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar perguntas do quiz
    const { data: quiz, error: quizError } = await supabase
      .from("revista_licao_quiz")
      .select("perguntas")
      .eq("id", quiz_id)
      .single();

    if (quizError || !quiz) {
      return new Response(JSON.stringify({ error: "Quiz não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const perguntas = Array.isArray(quiz.perguntas) ? quiz.perguntas : [];
    const totalPerguntas = perguntas.length;
    let acertos = 0;
    const respostasCorretas: string[] = [];

    perguntas.forEach((p: any, i: number) => {
      const correta = p.resposta_correta || "";
      respostasCorretas.push(correta);
      const respUsuario = respostas[String(i)];
      if (respUsuario && respUsuario.toUpperCase() === correta.toUpperCase()) {
        acertos++;
      }
    });

    const pontosGanhos = acertos * 10;

    // Upsert na tabela pública
    const { error: upsertError } = await supabase
      .from("revista_quiz_respostas_publico")
      .upsert(
        {
          quiz_id,
          licao_id,
          whatsapp,
          respostas,
          acertos,
          total_perguntas: totalPerguntas,
          pontos_ganhos: pontosGanhos,
        },
        { onConflict: "quiz_id,whatsapp" }
      );

    if (upsertError) {
      console.error("Erro ao salvar resposta:", upsertError);
      return new Response(JSON.stringify({ error: "Erro ao salvar resposta" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar revista_id da lição para o ranking
    const { data: licao } = await supabase
      .from("revista_licoes")
      .select("revista_id")
      .eq("id", licao_id)
      .single();

    if (licao?.revista_id) {
      // Buscar nome do comprador
      const { data: licenca } = await supabase
        .from("revista_licencas_shopify")
        .select("nome_comprador")
        .eq("whatsapp", whatsapp)
        .limit(1)
        .maybeSingle();

      const nomeComprador = licenca?.nome_comprador || "Leitor";

      // Check if ranking entry exists
      const { data: existing } = await supabase
        .from("revista_ranking_publico")
        .select("id, total_pontos, total_quizzes")
        .eq("whatsapp", whatsapp)
        .eq("revista_id", licao.revista_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("revista_ranking_publico")
          .update({
            total_pontos: existing.total_pontos + pontosGanhos,
            total_quizzes: existing.total_quizzes + 1,
            nome_comprador: nomeComprador,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("revista_ranking_publico")
          .insert({
            whatsapp,
            revista_id: licao.revista_id,
            nome_comprador: nomeComprador,
            total_pontos: pontosGanhos,
            total_quizzes: 1,
          });
      }
    }

    return new Response(
      JSON.stringify({
        acertos,
        total_perguntas: totalPerguntas,
        pontos_ganhos: pontosGanhos,
        respostas_corretas: respostasCorretas,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
