
# Plano: Corrigir Parâmetro da Função SQL no Consultor de BI

## Problema Identificado
Na edge function `gemini-assistente-gestao`, a chamada RPC está usando o parâmetro errado:
- **Atual (ERRADO):** `{ sql_query: query }`
- **Correto:** `{ query_text: query }`

A função do banco de dados `execute_readonly_query` espera um parâmetro chamado `query_text`, não `sql_query`.

## Arquivo a Modificar
`supabase/functions/gemini-assistente-gestao/index.ts`

## Alteração Necessária

### Linha 145 - Corrigir nome do parâmetro
```typescript
// ANTES (linha 145)
const { data, error } = await supabase.rpc('execute_readonly_query', { sql_query: query });

// DEPOIS
const { data, error } = await supabase.rpc('execute_readonly_query', { query_text: query });
```

## Configuração Confirmada
- **API Key:** OPENAI_API_KEY (já configurada nas Secrets)
- **Modelo:** gpt-4o-mini (já configurado no código)
- **Endpoint:** api.openai.com (já configurado no código)

## O que NÃO muda
- Endpoint OpenAI permanece `https://api.openai.com/v1/chat/completions`
- Modelo permanece `gpt-4o-mini`
- Chave permanece `OPENAI_API_KEY`
- Toda a lógica de tools, system prompt e processamento

## Após Implementação
1. Deploy automático da edge function
2. Teste com a pergunta: "Qual o valor do último pedido?"
3. Resposta esperada em R$ (Reais) com dados reais do banco
