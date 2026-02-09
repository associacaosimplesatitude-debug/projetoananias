import "npm:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { pdf_base64, banco } = await req.json();

    if (!pdf_base64 || !banco) {
      return new Response(JSON.stringify({ error: 'pdf_base64 and banco are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bankInstructions: Record<string, string> = {
      santander: `Este é um relatório de títulos líquidos do banco Santander. 
Extraia TODOS os títulos da tabela. Os campos relevantes são:
- "Pagador" ou "Sacado" → nome do cliente
- "Seu Número" → numero do titulo
- "Vencimento" → data de vencimento (formato DD/MM/YYYY)
- "Valor Título" ou "Vlr.Título" → valor do título
- A data de pagamento/liquidação geralmente aparece no cabeçalho do relatório ou como "Data Liquidação"`,
      
      delta: `Este é um relatório de títulos líquidos do banco Delta. 
Extraia TODOS os títulos da tabela. Os campos relevantes são:
- "Sacado" → nome do cliente
- "Duplicata" → numero do titulo
- "Vencimento" → data de vencimento (formato DD/MM/YYYY)
- "Valor Face" → valor do título
- "Dt.Liquidação" ou "Data Liquidação" → data de pagamento`,
      
      credifort: `Este é um relatório de títulos quitados da Credifort. 
Extraia TODOS os títulos da tabela. Os campos relevantes são:
- "Sacado" → nome do cliente  
- "Número" ou "Nosso Número" → numero do titulo
- "Vencimento" → data de vencimento (formato DD/MM/YYYY)
- "Valor Face" ou "Valor Título" → valor do título
- "Dt.Liquidação" ou "Data Liquidação" → data de pagamento`,
    };

    const instruction = bankInstructions[banco.toLowerCase()] || bankInstructions.santander;

    const systemPrompt = `Você é um extrator de dados de extratos bancários brasileiros. 
Analise a imagem do PDF e extraia TODOS os títulos/boletos listados.

${instruction}

REGRAS IMPORTANTES:
- Retorne APENAS um JSON válido, sem markdown, sem texto adicional
- Converta todas as datas para formato YYYY-MM-DD
- Converta valores para número decimal (sem R$, sem pontos de milhar, vírgula vira ponto). Ex: "1.235,35" → 1235.35
- Se a data de pagamento não estiver disponível para um título individual, use a data do relatório
- Inclua TODOS os títulos, sem exceção
- Se o nome do sacado estiver truncado, inclua o que estiver visível

Formato de saída:
{
  "banco": "${banco}",
  "data_relatorio": "YYYY-MM-DD",
  "titulos": [
    {
      "sacado": "NOME DO CLIENTE",
      "valor": 1234.56,
      "data_vencimento": "YYYY-MM-DD",
      "data_pagamento": "YYYY-MM-DD",
      "numero_titulo": "123456"
    }
  ]
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${pdf_base64}`,
                  detail: 'high',
                },
              },
              {
                type: 'text',
                text: 'Extraia todos os títulos deste extrato bancário conforme as instruções.',
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI error:', errorText);
      return new Response(JSON.stringify({ error: 'Failed to process PDF with OpenAI', details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content || '';

    // Parse the JSON response - handle markdown code blocks
    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse OpenAI response:', content);
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
