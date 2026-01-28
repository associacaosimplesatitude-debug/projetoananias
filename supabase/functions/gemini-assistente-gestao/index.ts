import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Force redeploy: 2026-01-26T21:40:00Z - New API key with full permissions

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

## REGRAS CRÍTICAS DE SQL

### NUNCA use ponto e vírgula nas queries
As queries NÃO devem terminar com ponto e vírgula (;). O RPC execute_readonly_query não aceita queries com ;
- ERRADO:  SELECT * FROM vendedores WHERE nome = 'Gloria';
- CORRETO: SELECT * FROM vendedores WHERE nome = 'Gloria'

### SEMPRE busque o vendedor PRIMEIRO
Quando o usuário perguntar sobre um vendedor específico (por nome):
1. PRIMEIRO busque o vendedor na tabela vendedores pelo nome para obter o ID e EMAIL REAIS
2. OBTENHA o email e id reais do resultado
3. SÓ DEPOIS use esses dados nas queries de vendas

**NUNCA invente emails** como 'elaine@email.com' ou 'gloria@exemplo.com'. Sempre busque primeiro:
SELECT id, nome, email FROM vendedores WHERE nome ILIKE '%elaine%'

### Status de vendedores é CASE-SENSITIVE
O campo status na tabela vendedores usa 'Ativo' (com A maiúsculo), não 'ativo'.
- ERRADO:  WHERE status = 'ativo'
- CORRETO: WHERE LOWER(status) = 'ativo'
- OU:      WHERE status ILIKE 'ativo'

### MANTER CONTEXTO TEMPORAL entre perguntas
Se o usuário perguntou sobre "vendas de HOJE" e depois pergunta sobre clientes desse vendedor:
- MANTENHA o filtro de data nas queries subsequentes
- Para "vendas de hoje": created_at::date = CURRENT_DATE
- Para "última semana": created_at >= CURRENT_DATE - INTERVAL '7 days'
- Para "este mês": created_at >= date_trunc('month', CURRENT_DATE)

Exemplo de conversa:
- User: "vendas de hoje" → filtrar por CURRENT_DATE
- User: "clientes da Gloria" → MANTER o filtro CURRENT_DATE da pergunta anterior

## IMPORTANTE: Fontes de Vendas

O sistema armazena vendas em **4 tabelas diferentes**. Para consultar vendas totais, você DEVE consultar TODAS:

### 1. vendedor_propostas (Pedidos B2B / Faturamento 30/60/90 dias)
- Campos principais: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome, cliente_cnpj, valor_total, status, bling_status_id, bling_order_id, nfe_numero, created_at
- **Campo do cliente**: cliente_nome
- **Status de venda concluída**: 'FATURADO', 'PAGO'
- Identificar vendedor por: vendedor_id ou vendedor_email

### 2. ebd_shopify_pedidos (Pedidos Shopify / Loja Online)
- Campos principais: id, shopify_order_id, vendedor_id, cliente_id, valor_total, valor_para_meta, status_pagamento, customer_name, customer_email, customer_phone, created_at
- **Campo do cliente**: customer_name
- **Status de venda concluída**: 'paid', 'Faturado'
- Identificar vendedor por: vendedor_id (fazer JOIN com vendedores para filtrar por email)

### 3. ebd_shopify_pedidos_mercadopago (Pagamentos Digitais PIX/Cartão)
- Campos principais: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome, valor_total, status, payment_method, mercadopago_payment_id, created_at
- **Campo do cliente**: cliente_nome
- **Status de venda concluída**: 'PAGO'
- Identificar vendedor por: vendedor_id ou vendedor_email

### 4. vendas_balcao (PDV / Pagar na Loja)
- Campos principais: id, vendedor_id, polo, cliente_nome, cliente_cpf, cliente_telefone, valor_total, forma_pagamento, status, bling_order_id, nota_fiscal_numero, created_at
- **Campo do cliente**: cliente_nome
- **Status de venda concluída**: 'finalizada'
- Identificar vendedor por: vendedor_id (fazer JOIN com vendedores para filtrar por email)

### 5. vendedores (Cadastro de Vendedores)
- Campos: id, nome, email, email_bling, status, tipo_perfil, is_gerente, gerente_id, comissao_percentual, meta_mensal_valor
- **Filtro para vendedores ativos**: WHERE LOWER(status) = 'ativo'

### 6. vendedor_propostas_parcelas (Comissões de Propostas B2B)
- Campos: id, proposta_id, numero_parcela, valor, data_vencimento, status, data_liberacao, valor_comissao
- Status de comissão: 'aguardando_nota', 'liberada', 'paga'

### 7. ebd_clientes (Clientes EBD / Igrejas)
- Campos: id, nome_igreja, cnpj, cpf, vendedor_id, status_ativacao_ebd, data_proxima_compra, email_superintendente, telefone

## Resumo: Campos de Cliente por Tabela

| Tabela                          | Campo do Cliente  | Outros campos úteis            |
|---------------------------------|-------------------|--------------------------------|
| vendedor_propostas              | cliente_nome      | cliente_id, cliente_cnpj       |
| ebd_shopify_pedidos             | customer_name     | customer_email, customer_phone |
| ebd_shopify_pedidos_mercadopago | cliente_nome      | cliente_id                     |
| vendas_balcao                   | cliente_nome      | cliente_cpf, cliente_telefone  |

## Como Buscar Vendas e Clientes de um Vendedor

### Passo 1: SEMPRE busque o vendedor primeiro
SELECT id, nome, email FROM vendedores WHERE nome ILIKE '%nome%'

### Passo 2: Use o email/id REAL nas queries (com filtro de data se aplicável)

-- Propostas B2B (use vendedor_email ou vendedor_id)
SELECT cliente_nome, valor_total, created_at FROM vendedor_propostas 
WHERE vendedor_email = 'email_real@dominio.com' AND status IN ('FATURADO', 'PAGO') AND created_at::date = CURRENT_DATE

-- Shopify (precisa JOIN)
SELECT esp.customer_name, esp.valor_total, esp.created_at FROM ebd_shopify_pedidos esp
JOIN vendedores v ON esp.vendedor_id = v.id
WHERE v.email = 'email_real@dominio.com' AND esp.status_pagamento = 'paid' AND esp.created_at::date = CURRENT_DATE

-- Mercado Pago (use vendedor_email ou vendedor_id)
SELECT cliente_nome, valor_total, created_at FROM ebd_shopify_pedidos_mercadopago
WHERE vendedor_email = 'email_real@dominio.com' AND status = 'PAGO' AND created_at::date = CURRENT_DATE

-- PDV/Balcão (precisa JOIN)
SELECT vb.cliente_nome, vb.valor_total, vb.created_at FROM vendas_balcao vb
JOIN vendedores v ON vb.vendedor_id = v.id
WHERE v.email = 'email_real@dominio.com' AND vb.status = 'finalizada' AND vb.created_at::date = CURRENT_DATE

## Conhecimento de Negócio

### Status Bling
- ID 1 = "Em andamento" (pedido em processamento)
- ID 6 = "Atendido/Faturado" (pedido concluído)

### Regras de Resposta
1. Seja objetivo e direto nas respostas
2. Para comissões, diferencie entre:
   - "aguardando_nota" = aguardando emissão de NF
   - "liberada" = pronta para pagamento
   - "paga" = já paga ao vendedor
3. Formate valores monetários como R$ X.XXX,XX
4. Formate datas como DD/MM/AAAA
5. Quando perguntar sobre vendas, SEMPRE consulte as 4 tabelas de vendas

### Exemplos de Uso
- "Vendas de hoje" → Consulte as 4 tabelas com filtro created_at::date = CURRENT_DATE
- "Clientes da Gloria hoje" → Busque Gloria primeiro, depois liste cliente_nome/customer_name das 4 tabelas COM filtro de data
- "Qual vendedor tem mais vendas este mês?" → Consulte as 4 tabelas, agrupe por vendedor e some

## IMPORTANTE: Diferença entre CLIENTE e PRODUTO

- **CLIENTE** = quem comprou (Igreja, pessoa, empresa)
  - Campos: cliente_nome, customer_name (nas tabelas de pedidos)
  
- **PRODUTO** = o que foi comprado (Livro, Revista, Bíblia)
  - Vem das tabelas/colunas de ITENS (veja abaixo)

**REGRA CRÍTICA**: Quando o usuário perguntar sobre PRODUTOS vendidos, você DEVE consultar as tabelas de ITENS, NÃO as tabelas de pedidos principais!

## Fontes de PRODUTOS (Itens Vendidos)

### 1. ebd_shopify_pedidos_itens (Itens de pedidos Shopify)
- Campos: id, pedido_id, product_title, variant_title, sku, quantity, price, total_discount
- **Campo do produto**: product_title
- **Relação**: JOIN com ebd_shopify_pedidos ON pedido_id = ebd_shopify_pedidos.id

Exemplo - Produtos mais vendidos hoje no Shopify:
SELECT i.product_title as produto, SUM(i.quantity) as total_qty, SUM(i.price * i.quantity) as total_valor
FROM ebd_shopify_pedidos_itens i
JOIN ebd_shopify_pedidos p ON i.pedido_id = p.id
WHERE p.status_pagamento = 'paid' AND p.created_at::date = CURRENT_DATE
GROUP BY i.product_title ORDER BY total_qty DESC

### 2. vendedor_propostas.itens (JSONB com itens B2B)
- Coluna JSONB na tabela vendedor_propostas
- Estrutura JSON: [{"title": "Nome do Produto", "quantity": 10, "price": 49.90, "sku": "123"}]
- **Campo do produto**: item->>'title'
- Usar jsonb_array_elements(itens) para expandir o array

Exemplo - Produtos mais vendidos hoje em propostas B2B:
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as total_qty, SUM((item->>'price')::numeric * (item->>'quantity')::int) as total_valor
FROM vendedor_propostas, jsonb_array_elements(itens) AS item
WHERE status IN ('FATURADO', 'PAGO') AND created_at::date = CURRENT_DATE AND itens IS NOT NULL
GROUP BY item->>'title' ORDER BY total_qty DESC

### 3. ebd_shopify_pedidos_mercadopago.items (JSONB com itens Mercado Pago)
- Coluna JSONB na tabela ebd_shopify_pedidos_mercadopago
- Estrutura JSON: [{"title": "Nome do Produto", "quantity": 5, "price": 69.90}]
- **Campo do produto**: item->>'title'
- Usar jsonb_array_elements(items) para expandir o array

Exemplo - Produtos mais vendidos hoje no Mercado Pago:
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as total_qty, SUM((item->>'price')::numeric * (item->>'quantity')::int) as total_valor
FROM ebd_shopify_pedidos_mercadopago, jsonb_array_elements(items) AS item
WHERE status = 'PAGO' AND created_at::date = CURRENT_DATE AND items IS NOT NULL
GROUP BY item->>'title' ORDER BY total_qty DESC

### 4. vendas_balcao - NÃO TEM ITENS DETALHADOS
- Vendas de balcão NÃO possuem detalhamento de produtos
- Apenas valor total e dados do cliente estão disponíveis
- Para perguntas sobre produtos de balcão, informe: "Vendas de balcão não possuem detalhamento de produtos, apenas o valor total."

## Resumo: CLIENTE vs PRODUTO

| Pergunta do Usuário                  | Onde Consultar                           | Campo a Usar                    |
|--------------------------------------|------------------------------------------|---------------------------------|
| "Qual CLIENTE comprou mais?"         | Tabelas de pedidos principais            | cliente_nome, customer_name     |
| "Qual PRODUTO vendeu mais?"          | Tabelas de ITENS                         | product_title, item->>'title'   |
| "Clientes da Gloria"                 | Tabelas de pedidos + JOIN vendedores     | cliente_nome, customer_name     |
| "Produtos vendidos pela Gloria"      | Tabelas de ITENS + JOIN com pedidos/vend | product_title, item->>'title'   |
| "Top 5 produtos do mês"              | Todas as tabelas de ITENS                | product_title, item->>'title'   |

## Exemplo Completo: Produtos de um Vendedor Específico

Para "Quais produtos a Gloria vendeu hoje?":

1. PRIMEIRO busque a Gloria:
SELECT id, nome, email FROM vendedores WHERE nome ILIKE '%gloria%'

2. DEPOIS consulte os itens de cada fonte (usando o email/id real obtido):

-- Itens de Propostas B2B
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as qty
FROM vendedor_propostas, jsonb_array_elements(itens) AS item
WHERE vendedor_email = 'email_real_gloria@dominio.com' AND status IN ('FATURADO', 'PAGO') AND created_at::date = CURRENT_DATE AND itens IS NOT NULL
GROUP BY item->>'title'

-- Itens do Shopify
SELECT i.product_title as produto, SUM(i.quantity) as qty
FROM ebd_shopify_pedidos_itens i
JOIN ebd_shopify_pedidos p ON i.pedido_id = p.id
JOIN vendedores v ON p.vendedor_id = v.id
WHERE v.email = 'email_real_gloria@dominio.com' AND p.status_pagamento = 'paid' AND p.created_at::date = CURRENT_DATE
GROUP BY i.product_title

-- Itens do Mercado Pago
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as qty
FROM ebd_shopify_pedidos_mercadopago, jsonb_array_elements(items) AS item
WHERE vendedor_email = 'email_real_gloria@dominio.com' AND status = 'PAGO' AND created_at::date = CURRENT_DATE AND items IS NOT NULL
GROUP BY item->>'title'`;

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
        required: ["query", "description"]
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
        required: ["produto_ids"]
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
        required: ["nfe_id"]
      }
    }
  }
];

// Helper function to add delay
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Execute SQL query
async function executeSql(supabase: any, query: string): Promise<string> {
  const normalizedQuery = query.trim().toUpperCase();
  if (!normalizedQuery.startsWith("SELECT")) {
    return "Erro: Apenas consultas SELECT são permitidas por segurança.";
  }

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
      console.log("[SQL] RPC error:", error.message);
      return `Erro na consulta: ${error.message}. Tente reformular a pergunta.`;
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
    const { data: config, error: configError } = await supabase
      .from('bling_config')
      .select('*')
      .single();

    if (configError || !config?.access_token) {
      return "Erro: Configuração do Bling não encontrada.";
    }

    const results = [];
    
    for (const produtoId of produtoIds) {
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

// Process tool calls with delay to avoid rate limits
async function processToolCalls(supabase: any, toolCalls: any[]): Promise<any[]> {
  const results = [];
  
  for (let i = 0; i < toolCalls.length; i++) {
    const toolCall = toolCalls[i];
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments || "{}");

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

    // Add 1 second delay between tool calls to avoid rate limits
    if (i < toolCalls.length - 1) {
      console.log("[Tool] Waiting 1s before next tool call...");
      await delay(1000);
    }
  }

  return results;
}

serve(async (req) => {
  console.log("[assistente-gestao] v2.1 - Request received");
  
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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    console.log("[assistente-gestao] OPENAI_API_KEY exists:", !!OPENAI_API_KEY);
    
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase for tool execution
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[assistente-gestao] Processing ${messages.length} messages with OpenAI ChatGPT`);

    // Build OpenAI messages array with system prompt
    const openaiMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages
    ];

    // First API call - may request tool use
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: openaiMessages,
        tools: tools,
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OPENAI ERROR] Status: ${response.status}, Body: ${errorText}`);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Aguarde alguns segundos e tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: `Erro de autenticação OpenAI (${response.status}): ${errorText}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `Erro OpenAI (${response.status}): ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let responseData = await response.json();
    let assistantMessage = responseData.choices?.[0]?.message;

    // Process tool calls in a loop
    let iterations = 0;
    const maxIterations = 5;
    
    while (iterations < maxIterations && assistantMessage?.tool_calls) {
      const toolCalls = assistantMessage.tool_calls;
      
      console.log(`[assistente-gestao] Processing ${toolCalls.length} tool calls (iteration ${iterations + 1})`);
      
      // Add 1 second delay before processing tools to respect rate limits
      if (iterations > 0) {
        console.log("[assistente-gestao] Waiting 1s before next API call...");
        await delay(1000);
      }
      
      // Execute the tools
      const toolResults = await processToolCalls(supabase, toolCalls);
      
      // Add assistant message and tool results to conversation
      openaiMessages.push(assistantMessage);
      openaiMessages.push(...toolResults);

      // Call the API again with tool results
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openaiMessages,
          tools: tools,
          tool_choice: "auto"
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error on tool response: ${response.status}`, errorText);
        
        if (response.status === 429) {
          // Wait longer and retry once
          console.log("[assistente-gestao] Rate limited, waiting 2s and retrying...");
          await delay(2000);
          
          response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENAI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: openaiMessages,
              tools: tools,
              tool_choice: "auto"
            }),
          });
          
          if (!response.ok) {
            return new Response(
              JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em alguns segundos." }),
              { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          break;
        }
      }

      responseData = await response.json();
      assistantMessage = responseData.choices?.[0]?.message;
      iterations++;
    }

    // Extract final text response
    const finalContent = assistantMessage?.content || "Desculpe, não consegui processar sua solicitação.";

    console.log("[assistente-gestao] Final response ready, length:", finalContent.length);

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
    console.error("[assistente-gestao] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
