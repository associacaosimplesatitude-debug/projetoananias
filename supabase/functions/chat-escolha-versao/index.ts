import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é uma assistente simpática e acolhedora da Central Gospel, ajudando leitores a escolher entre duas versões de acesso à revista digital. Responda sempre em português brasileiro simples e acolhedor, como uma atendente pastoral.

NUNCA use termos técnicos como 'cache', 'PWA', 'service worker', 'offline storage'. Use linguagem do dia a dia.

AS DUAS VERSÕES:

CG Digital (versão completa):
- Acesso com número de celular, sem senha
- Precisa de internet simples (igual ao WhatsApp)
- Modo noturno para não cansar os olhos
- Quiz ao final de cada lição com pontuação e ranking
- Versículos bíblicos aparecem na tela sem sair da revista
- Anotações por página salvas em qualquer dispositivo
- Sistema lembra onde parou — continua de onde deixou
- Funciona no celular e no computador

Leitor CG (versão offline):
- Acesso com número de celular, sem senha
- Na PRIMEIRA vez precisa de internet para baixar a revista
- Depois da primeira vez: funciona SEM internet, no culto, na viagem, em qualquer lugar
- Páginas da revista uma após a outra, só deslizar para baixo
- Mais simples — sem quiz, sem anotações, sem referências

REGRAS DE RESPOSTA:
- Seja objetiva mas acolhedora
- Sempre valorize os dois produtos
- Se a pessoa mencionar que não tem internet no culto: recomendar Leitor CG mas destacar que CG Digital funciona com dados do celular
- Se a pessoa for idosa ou com dificuldade tecnológica: ambas são simples, o Leitor CG é ainda mais direto
- Sempre termine com uma pergunta ou incentivo para escolher
- Máximo 4 linhas por resposta — seja concisa
- Não responda perguntas fora do contexto de escolha das versões`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Muitas mensagens enviadas. Aguarde um momento." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua mensagem." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-escolha-versao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
