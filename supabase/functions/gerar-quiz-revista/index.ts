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

    const selectedPages = paginas.length > 3 ? paginas.slice(1, 9) : paginas.slice(0);
    const imageContents = selectedPages.map((url: string) => ({
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
            content: `Você é um professor de Escola Bíblica Dominical (EBD). Analise as imagens desta lição e gere exatamente 3 perguntas de múltipla escolha sobre o CONTEÚDO BÍBLICO da lição.

REGRAS OBRIGATÓRIAS:
- As perguntas devem ser sobre o ensino bíblico, os versículos, os personagens bíblicos ou as aplicações práticas da lição
- Use a pergunta de fixação que já aparece impressa no final da lição como uma das 3 perguntas
- PROIBIDO perguntar sobre: autor, editora, faixa etária, número da revista, nome da série, ano, trimestre ou qualquer informação de capa/propaganda
- IGNORE imagens de capa, contracapa, propaganda, índice, expediente e páginas introdutórias
- Analise APENAS as páginas com conteúdo bíblico da lição
- As opções incorretas devem ser plausíveis mas claramente erradas para quem leu a lição
- Nível de dificuldade: adequado para adultos e jovens da EBD
- Idioma: português brasileiro`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise estas páginas da Lição ${licao.numero} "${licao.titulo || ""}" e crie 3 perguntas de múltipla escolha com 3 alternativas (A, B, C) cada, focando EXCLUSIVAMENTE no conteúdo bíblico ensinado na lição. Identifique a pergunta de fixação impressa nas páginas e use-a como uma das 3 perguntas.`,
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
              description: "Cria um quiz com 3 perguntas de múltipla escolha baseadas na lição bíblica",
              parameters: {
                type: "object",
                properties: {
                  perguntas: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        ordem: { type: "number", description: "Número da pergunta (1-3)" },
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
