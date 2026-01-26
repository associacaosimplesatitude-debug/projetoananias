

## Plano: Migrar Consultor de BI de Gemini para ChatGPT

### Situação Atual

O assistente usa a **API do Google Gemini** (`gemini-2.0-flash`) com:
- Endpoint: `generativelanguage.googleapis.com`
- Autenticação: `GEMINI_API_KEY`
- Formato de mensagens: Gemini-specific (contents, parts)
- Tool calling: Gemini format (functionDeclarations)

### O Que Será Alterado

Migrar para a **API do OpenAI ChatGPT** com:
- Endpoint: `api.openai.com/v1/chat/completions`
- Autenticação: `OPENAI_API_KEY` (você precisará adicionar)
- Modelo sugerido: `gpt-4o` ou `gpt-4o-mini` (mais barato)
- Formato: OpenAI native (messages array, tools array)

### Pré-requisito

Você precisará adicionar o secret `OPENAI_API_KEY` com sua chave da OpenAI.

### Arquivo a Modificar

`supabase/functions/gemini-assistente-gestao/index.ts`

### Mudanças Técnicas

| Aspecto | Gemini (Atual) | ChatGPT (Novo) |
|---------|----------------|----------------|
| Endpoint | generativelanguage.googleapis.com | api.openai.com/v1/chat/completions |
| Auth Header | Query param `?key=` | Header `Authorization: Bearer` |
| Mensagens | `contents: [{ role, parts }]` | `messages: [{ role, content }]` |
| System Prompt | `systemInstruction` | Primeira mensagem com `role: "system"` |
| Tools | `functionDeclarations` | `tools: [{ type: "function", function: {...} }]` |
| Tool Response | `functionResponse` | Message com `role: "tool"` |
| Streaming | Não usado | Pode usar SSE |

### Detalhes da Implementação

#### 1. Trocar variável de ambiente
```typescript
// ANTES
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// DEPOIS
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
```

#### 2. Converter formato das tools
```typescript
// ANTES (Gemini)
const tools = [{ functionDeclarations: [...] }];

// DEPOIS (OpenAI)
const tools = [
  {
    type: "function",
    function: {
      name: "execute_sql",
      description: "...",
      parameters: { type: "object", properties: {...} }
    }
  }
];
```

#### 3. Converter formato das mensagens
```typescript
// ANTES (Gemini)
function toGeminiFormat(messages) {
  return messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }]
  }));
}

// DEPOIS (OpenAI - já é o formato nativo)
// Não precisa converter, usar direto
```

#### 4. Mudar chamada da API
```typescript
// ANTES
fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`)

// DEPOIS
fetch("https://api.openai.com/v1/chat/completions", {
  headers: {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini", // ou gpt-4o
    messages: [...],
    tools: [...],
    tool_choice: "auto"
  })
})
```

#### 5. Processar tool calls (formato diferente)
```typescript
// ANTES (Gemini)
const functionCalls = parts.filter(p => p.functionCall);

// DEPOIS (OpenAI)
const toolCalls = response.choices[0].message.tool_calls;
```

#### 6. Enviar resultados das tools
```typescript
// ANTES (Gemini)
geminiContents.push({ role: "user", parts: [{ functionResponse: {...} }] });

// DEPOIS (OpenAI)
messages.push({ role: "tool", tool_call_id: "...", content: "..." });
```

### Modelo Recomendado

| Modelo | Custo | Velocidade | Capacidade |
|--------|-------|------------|------------|
| gpt-4o-mini | Mais barato | Rápido | Excelente para BI |
| gpt-4o | Médio | Médio | Máxima capacidade |
| gpt-3.5-turbo | Mais barato | Muito rápido | Básico |

**Recomendação**: `gpt-4o-mini` - melhor custo-benefício para análise de dados.

### Delay entre chamadas

Manterei o delay de 1 segundo entre tool calls para evitar rate limits, mesmo que a OpenAI tenha limites mais generosos.

### Passos de Implementação

1. Solicitar que você adicione o secret `OPENAI_API_KEY`
2. Reescrever a edge function com formato OpenAI
3. Converter ferramentas para formato OpenAI
4. Ajustar processamento de tool calls
5. Manter mesma lógica de negócio (SQL, Bling stock, NFe)
6. Deploy e teste

### Resultado Esperado

O Consultor de BI funcionará exatamente igual, mas usando ChatGPT ao invés de Gemini:
- Mesmas perguntas suportadas
- Mesmas ferramentas (SQL, estoque, NF-e)
- Respostas em português
- Formatação de valores em R$

