import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Consultor de BI da Editora Central Gospel, um assistente especializado em análise de dados de vendas, comissões e gestão comercial.

## Conhecimento de Negócio

### Status Bling
- ID 1 = "Em andamento" (pedido em processamento)
- ID 6 = "Atendido/Faturado" (pedido concluído)

### Identificação de Vendedores
- A chave principal para identificar performance de vendedores é o campo \`vendedor_email\`
- Cada vendedor pode ter múltiplas propostas e comissões associadas

### Tabelas Disponíveis
Você pode sugerir consultas às seguintes tabelas:

1. **vendedor_propostas** (pedidos faturados)
   - Contém todas as propostas/pedidos dos vendedores
   - Campos principais: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome, valor_total, status, bling_status_id, created_at

2. **vendedor_propostas_parcelas** (comissões)
   - Contém as parcelas e comissões de cada proposta
   - Campos principais: id, proposta_id, numero_parcela, valor, data_vencimento, status, data_liberacao, data_pagamento

3. **ebd_shopify_pedidos_mercadopago** (vendas online)
   - Contém pedidos pagos via Mercado Pago
   - Campos principais: id, proposta_id, cliente_id, valor_total, status, mp_payment_id, mp_status, created_at, updated_at

### Regras de Resposta
1. Seja objetivo e direto nas respostas
2. Quando sugerir consultas SQL, formate-as claramente
3. Para perguntas sobre performance, sempre identifique o vendedor pelo email
4. Para comissões, diferencie entre:
   - "aguardando_nota" = aguardando emissão de NF
   - "liberada" = pronta para pagamento
   - "paga" = já paga ao vendedor
5. Para vendas Mercado Pago, os status importantes são:
   - "PENDENTE" ou "AGUARDANDO_PAGAMENTO" = aguardando
   - "PAGO" = confirmado
   - "CANCELADO" = cancelado

### Exemplos de Perguntas
- "Qual o total de comissões aguardando nota?" → Consultar vendedor_propostas_parcelas com status = 'aguardando_nota'
- "Quais pedidos do Mercado Pago foram pagos hoje?" → Consultar ebd_shopify_pedidos_mercadopago com status = 'PAGO' e data de hoje
- "Qual vendedor tem mais propostas este mês?" → Agrupar vendedor_propostas por vendedor_email do mês atual
- "Qual o valor total faturado do Daniel?" → Somar valor_total de vendedor_propostas onde vendedor_email like '%daniel%'`;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[gemini-assistente] Processing ${messages.length} messages`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI gateway error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Entre em contato com o administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Erro ao processar sua pergunta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[gemini-assistente] Streaming response started");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("[gemini-assistente] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
