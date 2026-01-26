import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o Consultor de BI da Editora Central Gospel, um assistente especializado em análise de dados de vendas, comissões e gestão comercial.

## REGRAS CRÍTICAS DE RESPOSTA
1. **NUNCA** responda com blocos de código SQL. Você tem ferramentas para executar queries e deve usá-las.
2. Quando precisar de dados, use a ferramenta "execute_sql" para consultar o banco.
3. Quando precisar verificar estoque ou status de NF-e, use as ferramentas do Bling.
4. Sempre responda em linguagem natural com os dados já processados e formatados.
5. Apresente números formatados (R$ para valores, datas em formato brasileiro).

## Conhecimento de Negócio

### Status Bling
- ID 1 = "Em andamento" (pedido em processamento)
- ID 6 = "Atendido/Faturado" (pedido concluído)

### Identificação de Vendedores
- A chave principal para identificar performance de vendedores é o campo \`vendedor_email\`
- Cada vendedor pode ter múltiplas propostas e comissões associadas

### Tabelas Disponíveis
Você pode executar consultas SELECT nas seguintes tabelas:

1. **vendedor_propostas** (pedidos faturados)
   - Campos: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome, valor_total, status, bling_status_id, created_at, bling_order_id, nfe_numero, nfe_link_danfe

2. **vendedor_propostas_parcelas** (comissões)
   - Campos: id, proposta_id, numero_parcela, valor, data_vencimento, status (aguardando_nota, liberada, paga), data_liberacao, data_pagamento, valor_comissao

3. **ebd_shopify_pedidos_mercadopago** (vendas online)
   - Campos: id, proposta_id, cliente_id, valor_total, status (PENDENTE, AGUARDANDO_PAGAMENTO, PAGO, CANCELADO), mp_payment_id, mp_status, created_at, updated_at

4. **ebd_clientes** (clientes EBD)
   - Campos: id, nome_igreja, cnpj, cpf, vendedor_id, status_ativacao_ebd, data_proxima_compra

5. **vendedores** (vendedores)
   - Campos: id, nome, email, is_gerente, gerente_id, is_active

### Regras de Resposta
1. Seja objetivo e direto nas respostas
2. Para comissões, diferencie entre:
   - "aguardando_nota" = aguardando emissão de NF
   - "liberada" = pronta para pagamento
   - "paga" = já paga ao vendedor
3. Formate valores monetários como R$ X.XXX,XX
4. Formate datas como DD/MM/AAAA

### Exemplos de Uso de Ferramentas
- "Qual o total de comissões aguardando nota?" → Use execute_sql com query para somar valor_comissao onde status = 'aguardando_nota'
- "Quais pedidos do Mercado Pago foram pagos hoje?" → Use execute_sql para buscar em ebd_shopify_pedidos_mercadopago
- "Qual vendedor tem mais propostas este mês?" → Use execute_sql com GROUP BY vendedor_email
- "Verifique o estoque do produto X" → Use check_bling_stock`;

// Tool definitions for the AI
const tools = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "Executa uma consulta SELECT no banco de dados PostgreSQL e retorna os resultados. Use apenas para consultas de leitura (SELECT). NUNCA responda com SQL, sempre execute esta ferramenta.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "A consulta SQL SELECT a ser executada. Apenas SELECT é permitido."
          },
          description: {
            type: "string",
            description: "Breve descrição do que a consulta busca"
          }
        },
        required: ["query", "description"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_bling_stock",
      description: "Verifica o estoque de produtos no sistema Bling. Use quando precisar saber quantidade disponível de produtos.",
      parameters: {
        type: "object",
        properties: {
          produto_ids: {
            type: "array",
            items: { type: "number" },
            description: "IDs dos produtos no Bling para verificar estoque"
          }
        },
        required: ["produto_ids"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_nfe_status",
      description: "Verifica o status de uma Nota Fiscal Eletrônica (NF-e) no Bling. Use para consultar se uma NF foi emitida, autorizada ou se há problemas.",
      parameters: {
        type: "object",
        properties: {
          nfe_id: {
            type: "number",
            description: "ID da NF-e no Bling"
          }
        },
        required: ["nfe_id"],
        additionalProperties: false
      }
    }
  }
];

// Execute SQL query
async function executeSql(supabase: any, query: string): Promise<string> {
  // Validate that it's a SELECT query only
  const normalizedQuery = query.trim().toUpperCase();
  if (!normalizedQuery.startsWith("SELECT")) {
    return "Erro: Apenas consultas SELECT são permitidas por segurança.";
  }

  // Block dangerous patterns
  const dangerousPatterns = [
    /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)/i,
    /--/,
    /\/\*/,
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(query)) {
      return "Erro: Query contém padrões não permitidos.";
    }
  }

  try {
    const { data, error } = await supabase.rpc('execute_readonly_query', { sql_query: query });
    
    if (error) {
      // Try direct query as fallback
      console.log("[SQL] RPC failed, trying direct query approach");
      
      // For simple queries, we can use the REST API approach
      // Parse the table name from the query
      const tableMatch = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      if (!tableMatch) {
        return `Erro na consulta: ${error.message}`;
      }
      
      // Use raw SQL via postgrest
      const response = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/execute_readonly_query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
          },
          body: JSON.stringify({ sql_query: query })
        }
      );
      
      if (!response.ok) {
        // Last resort: try to parse and execute using supabase client
        return `Erro na consulta SQL: ${error.message}. Tente reformular a pergunta.`;
      }
      
      const result = await response.json();
      return JSON.stringify(result, null, 2);
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return "Nenhum resultado encontrado para esta consulta.";
    }

    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.error("[SQL] Error:", err);
    return `Erro ao executar consulta: ${err instanceof Error ? err.message : "Erro desconhecido"}`;
  }
}

// Check Bling stock
async function checkBlingStock(supabase: any, produtoIds: number[]): Promise<string> {
  try {
    // Get Bling config
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config?.access_token) {
      return "Erro: Configuração do Bling não encontrada.";
    }

    const results = [];
    
    for (const produtoId of produtoIds) {
      // First get product info
      const productResponse = await fetch(
        `https://www.bling.com.br/Api/v3/produtos/${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!productResponse.ok) {
        results.push({ id: produtoId, erro: "Produto não encontrado" });
        continue;
      }

      const productData = await productResponse.json();
      const produto = productData.data;

      // Get stock info
      const stockResponse = await fetch(
        `https://www.bling.com.br/Api/v3/estoques/saldos?idsProdutos[]=${produtoId}`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
            'Accept': 'application/json',
          },
        }
      );

      let estoque = 0;
      if (stockResponse.ok) {
        const stockData = await stockResponse.json();
        for (const item of stockData.data || []) {
          if (item.saldos && Array.isArray(item.saldos)) {
            for (const saldo of item.saldos) {
              estoque += (saldo.saldoFisicoTotal || 0);
            }
          }
        }
      }

      // Fallback to product stock
      if (estoque === 0 && produto?.estoque) {
        estoque = produto.estoque.saldoVirtualTotal || produto.estoque.saldoFisicoTotal || 0;
      }

      results.push({
        id: produtoId,
        nome: produto?.nome || "Desconhecido",
        codigo: produto?.codigo || "",
        estoque_disponivel: estoque,
        preco: produto?.preco || 0
      });
    }

    return JSON.stringify(results, null, 2);
  } catch (err) {
    console.error("[Bling Stock] Error:", err);
    return `Erro ao verificar estoque: ${err instanceof Error ? err.message : "Erro desconhecido"}`;
  }
}

// Check NFe status
async function checkNfeStatus(supabase: any, nfeId: number): Promise<string> {
  try {
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config?.access_token) {
      return "Erro: Configuração do Bling não encontrada.";
    }

    const nfeResponse = await fetch(
      `https://api.bling.com.br/Api/v3/nfe/${nfeId}`,
      {
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!nfeResponse.ok) {
      return `Erro: NF-e ${nfeId} não encontrada no Bling.`;
    }

    const nfeData = await nfeResponse.json();
    const nfe = nfeData.data;

    const statusMap: Record<string, string> = {
      "1": "Pendente",
      "2": "Cancelada",
      "3": "Aguardando recibo",
      "4": "Rejeitada",
      "5": "Autorizada",
      "6": "Emitida DANFE",
      "7": "Registrada",
      "8": "Aguardando protocolo",
      "9": "Denegada",
      "10": "Consulta situação"
    };

    return JSON.stringify({
      id: nfe?.id,
      numero: nfe?.numero,
      serie: nfe?.serie,
      status: statusMap[nfe?.situacao?.toString()] || `Status ${nfe?.situacao}`,
      situacao_codigo: nfe?.situacao,
      chave_acesso: nfe?.chaveAcesso,
      data_emissao: nfe?.dataEmissao,
      valor_total: nfe?.valorNota,
      cliente: nfe?.contato?.nome,
      link_danfe: nfe?.linkDanfe || nfe?.xml?.linkDanfe || null
    }, null, 2);
  } catch (err) {
    console.error("[NFe Status] Error:", err);
    return `Erro ao verificar NF-e: ${err instanceof Error ? err.message : "Erro desconhecido"}`;
  }
}

// Process tool calls from AI response
async function processToolCalls(supabase: any, toolCalls: any[]): Promise<any[]> {
  const results = [];
  
  for (const toolCall of toolCalls) {
    const functionName = toolCall.function.name;
    let args;
    
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      results.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: "Erro: Argumentos inválidos"
      });
      continue;
    }

    console.log(`[Tool] Executing ${functionName} with args:`, args);

    let result: string;
    
    switch (functionName) {
      case "execute_sql":
        result = await executeSql(supabase, args.query);
        break;
      case "check_bling_stock":
        result = await checkBlingStock(supabase, args.produto_ids);
        break;
      case "check_nfe_status":
        result = await checkNfeStatus(supabase, args.nfe_id);
        break;
      default:
        result = `Erro: Ferramenta "${functionName}" não reconhecida`;
    }

    console.log(`[Tool] ${functionName} result:`, result.substring(0, 500));

    results.push({
      tool_call_id: toolCall.id,
      role: "tool",
      content: result
    });
  }

  return results;
}

serve(async (req) => {
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

    // Initialize Supabase for tool execution
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[gemini-assistente] Processing ${messages.length} messages with tool calling`);

    // First API call - may request tool use
    let response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        tools: tools,
        tool_choice: "auto",
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

    let responseData = await response.json();
    let assistantMessage = responseData.choices?.[0]?.message;

    // Check if the AI wants to use tools
    let iterations = 0;
    const maxIterations = 5;
    
    while (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
      console.log(`[gemini-assistente] Processing ${assistantMessage.tool_calls.length} tool calls (iteration ${iterations + 1})`);
      
      // Execute the tools
      const toolResults = await processToolCalls(supabase, assistantMessage.tool_calls);
      
      // Build updated messages array with tool results
      const updatedMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
        assistantMessage,
        ...toolResults
      ];

      // Call the AI again with tool results
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: updatedMessages,
          tools: tools,
          tool_choice: "auto",
        }),
      });

      if (!response.ok) {
        break;
      }

      responseData = await response.json();
      assistantMessage = responseData.choices?.[0]?.message;
      iterations++;
    }

    // Return the final response
    const finalContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

    console.log("[gemini-assistente] Final response ready");

    // Return as SSE format for compatibility with existing frontend
    const sseData = `data: ${JSON.stringify({
      choices: [{
        delta: { content: finalContent },
        finish_reason: "stop"
      }]
    })}\n\ndata: [DONE]\n\n`;

    return new Response(sseData, {
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
