

## Plano: Corrigir leitura do erro de documento inválido no frontend

### Problema
A edge function retorna `status: 400` com `{ error_code: 'DOCUMENTO_INVALIDO', error: '...' }` no corpo. Porém, `supabase.functions.invoke()` trata qualquer resposta não-2xx como `FunctionsHttpError`, colocando o erro no campo `error` (não em `data`). O código atual no `handleAprovar` (linha 155-158) captura esse erro genérico e faz `throw`, sem nunca chegar ao bloco que verifica `DOCUMENTO_INVALIDO` (linha 160-170).

### Correção

**Arquivo:** `src/pages/admin/AprovacaoFaturamento.tsx`

No bloco `if (error)` (linhas 155-158), antes de fazer throw, tentar extrair o corpo JSON da resposta do erro usando `error.context.json()`:

```typescript
if (error) {
  console.error("[APROVAR] ❌ Erro na chamada:", error);
  
  // Tentar extrair corpo da resposta para erros HTTP (como DOCUMENTO_INVALIDO)
  if (error.context && typeof error.context.json === 'function') {
    try {
      const errorBody = await error.context.json();
      if (errorBody?.error_code === 'DOCUMENTO_INVALIDO') {
        toast.error("⚠️ CNPJ/CPF INVÁLIDO", {
          description: errorBody.error,
          duration: 10000,
        });
        refetch();
        return;
      }
      // Outro erro com corpo JSON
      throw new Error(errorBody?.error || error.message || "Erro ao aprovar");
    } catch (jsonErr) {
      // Se não conseguiu ler JSON, usar mensagem genérica
      if (jsonErr instanceof Error && jsonErr.message !== error.message) {
        throw jsonErr; // re-throw se já é nosso erro customizado
      }
    }
  }
  
  throw new Error(error.message || "Erro ao chamar função de aprovação");
}
```

Isso é tudo — apenas o tratamento de erro no frontend precisa ser ajustado. A edge function já está correta e salva o flag no banco.

