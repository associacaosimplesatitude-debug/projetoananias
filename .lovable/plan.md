

# Plano: Atualizar Chave OpenAI e Forçar Redeploy

## Verificação do Código Atual
Confirmei que o código já está correto:
- **Linha 145:** `{ query_text: query }` - parâmetro correto
- **Linha 392:** modelo `gpt-4o-mini` - conforme solicitado
- **Linha 385:** endpoint OpenAI correto

## Ações Necessárias

### 1. Atualizar Secret OPENAI_API_KEY
Substituir a chave atual pela nova chave com permissões totais que você gerou.

### 2. Forçar Redeploy da Edge Function
Adicionar um comentário com timestamp no código para garantir que o Supabase faça um deploy completamente novo, limpando qualquer cache:

```typescript
// Force redeploy: 2026-01-26T21:35:00Z - New API key with full permissions
```

### 3. Verificação Pós-Deploy
Após o deploy, testar chamando a função para verificar se o erro "Missing Scopes" persiste.

## Detalhamento Técnico

### Arquivo: supabase/functions/gemini-assistente-gestao/index.ts
Adicionar comentário no topo do arquivo (após os imports) para forçar rebuild:

```text
Linha ~5: Adicionar comentário de versão/timestamp
```

## Resultado Esperado
Com a nova chave que possui "All Permissions", a chamada à API OpenAI deve retornar sucesso e o assistente deve conseguir executar queries SQL e retornar dados formatados em português.

