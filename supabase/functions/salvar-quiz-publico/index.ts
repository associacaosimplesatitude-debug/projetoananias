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
