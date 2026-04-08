import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é uma assistente simpática e acolhedora da Central Gospel, ajudando leitores a escolher ENTRE duas versões de acesso à revista digital. São versões diferentes — a pessoa escolhe apenas UMA.

Responda sempre em português brasileiro simples e acolhedor, como uma atendente pastoral. Máximo 4 linhas por resposta.

REGRA MAIS IMPORTANTE:
A pessoa deve escolher APENAS UMA versão — não é possível usar as duas ao mesmo tempo. Cada versão tem seu próprio acesso e forma de funcionar.

AS DUAS VERSÕES:

CG Digital (versão completa):
- Acesso com número de celular, sem senha
- Precisa de internet simples (igual ao WhatsApp, 3G já basta)
- Modo noturno para não cansar os olhos
- Quiz ao final de cada lição com pontuação e ranking
- Versículos bíblicos aparecem na tela sem sair da revista
- Anotações por página salvas em qualquer dispositivo
- Sistema lembra onde parou — continua de onde deixou
- Funciona no celular e no computador

Leitor CG (versão offline):
- Acesso com número de celular, sem senha
- Na PRIMEIRA vez precisa de internet para baixar a revista
- Depois da primeira vez: funciona SEM internet, no culto, na viagem, em qualquer lugar — sem precisar de dados
- Páginas da revista uma após a outra, só deslizar para baixo
- Mais simples — sem quiz, sem anotações, sem referências

REGRAS DE RESPOSTA:
- Seja objetiva mas acolhedora
- Sempre valorize os dois produtos
- Se a pessoa perguntar se pode usar as duas: explicar que escolhe apenas uma, mas pode mudar a preferência a qualquer momento
- Se mencionar que não tem internet no culto: recomendar Leitor CG mas destacar que CG Digital funciona com 3G simples
- Se for idosa ou com dificuldade tecnológica: ambas são simples, o Leitor CG é ainda mais direto
- Sempre termine com uma pergunta ou incentivo para escolher
- Não responda perguntas fora do contexto de escolha das versões
- Se perguntarem sobre suporte, problemas técnicos ou outros assuntos: redirecionar gentilmente para a escolha`;

// Try Lovable AI Gateway first, fallback to Anthropic
async function callLovableAI(messages: any[]) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.log("LOVABLE_API_KEY not available, skipping gateway");
    return null;
  }

  const models = ["google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];

  for (const model of models) {
    console.log(`Trying Lovable AI with model: ${model}`);
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        }),
      });

      console.log(`Model ${model} response status:`, response.status);

      if (response.status === 429) return { rateLimited: true };
      if (response.status === 402) return { paymentRequired: true };

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content;
        if (reply) return { reply };
      }

      const errText = await response.text();
      console.error(`Model ${model} failed:`, response.status, errText);
    } catch (e) {
      console.error(`Model ${model} error:`, e);
    }
  }

  return null;
}

async function callAnthropicFallback(messages: any[]) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    console.log("No fallback API key available");
    return null;
  }

  console.log("Falling back to OpenAI API");
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 500,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      }),
    });

    console.log("OpenAI response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) return { reply };
    }

    const errText = await response.text();
    console.error("OpenAI error:", response.status, errText);
  } catch (e) {
    console.error("OpenAI fallback error:", e);
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();

    // Try Lovable AI first
    const lovableResult = await callLovableAI(messages);

    if (lovableResult?.rateLimited) {
      return new Response(JSON.stringify({ error: "Muitas mensagens enviadas. Aguarde um momento." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lovableResult?.paymentRequired) {
      return new Response(JSON.stringify({ error: "Serviço temporariamente indisponível." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lovableResult?.reply) {
      return new Response(JSON.stringify({ reply: lovableResult.reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback to OpenAI
    const fallbackResult = await callAnthropicFallback(messages);
    if (fallbackResult?.reply) {
      return new Response(JSON.stringify({ reply: fallbackResult.reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Não foi possível processar sua mensagem." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-escolha-versao error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
