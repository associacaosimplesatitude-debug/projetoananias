import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { licao_id } = await req.json();
    if (!licao_id) {
      return new Response(JSON.stringify({ error: "licao_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get lesson pages
    const { data: licao, error: licaoError } = await supabase
      .from("revista_licoes")
      .select("id, numero, titulo, paginas, revista_id")
      .eq("id", licao_id)
      .single();

    if (licaoError || !licao) {
      return new Response(JSON.stringify({ error: "Lição não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paginas = (licao.paginas as string[]) || [];
    if (paginas.length === 0) {
      return new Response(JSON.stringify({ error: "Lição sem páginas para analisar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build image content for the AI - send image URLs
    const imageContents = paginas.slice(0, 8).map((url: string) => ({
      type: "image_url" as const,
      image_url: { url },
    }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em educação bíblica. Analise as imagens de uma lição de Escola Bíblica Dominical e crie exatamente 5 perguntas de múltipla escolha baseadas no conteúdo visual.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise estas páginas da Lição ${licao.numero} "${licao.titulo || ""}" e crie 5 perguntas de múltipla escolha com 3 alternativas (A, B, C) cada. As perguntas devem testar o conhecimento do aluno sobre o conteúdo bíblico apresentado na lição.`,
              },
              ...imageContents,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "criar_quiz",
              description: "Cria um quiz com 5 perguntas de múltipla escolha baseadas na lição bíblica",
              parameters: {
                type: "object",
                properties: {
                  perguntas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ordem: { type: "number", description: "Número da pergunta (1-5)" },
                        pergunta: { type: "string", description: "Texto da pergunta" },
                        opcao_a: { type: "string", description: "Alternativa A" },
                        opcao_b: { type: "string", description: "Alternativa B" },
                        opcao_c: { type: "string", description: "Alternativa C" },
                        resposta_correta: { type: "string", enum: ["A", "B", "C"], description: "Letra da resposta correta" },
                      },
                      required: ["ordem", "pergunta", "opcao_a", "opcao_b", "opcao_c", "resposta_correta"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["perguntas"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "criar_quiz" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para gerar quiz." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao gerar quiz com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "IA não retornou quiz estruturado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const quizData = JSON.parse(toolCall.function.arguments);
    const perguntas = quizData.perguntas;

    // Upsert quiz
    const { data: existingQuiz } = await supabase
      .from("revista_licao_quiz")
      .select("id")
      .eq("licao_id", licao_id)
      .maybeSingle();

    if (existingQuiz) {
      await supabase
        .from("revista_licao_quiz")
        .update({ perguntas })
        .eq("id", existingQuiz.id);
    } else {
      await supabase
        .from("revista_licao_quiz")
        .insert({ licao_id, perguntas });
    }

    return new Response(JSON.stringify({ success: true, perguntas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
