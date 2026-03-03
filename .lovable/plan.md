

## Plano: Melhorar diagnóstico de erros na Edge Function `bling-search-campaign-audience`

Alterações **apenas** no arquivo `supabase/functions/bling-search-campaign-audience/index.ts`:

### 1. Logar token utilizado (primeiros 10 chars)
Na função `searchOrdersPaginated`, logo no início, adicionar:
```
console.log("Token usado:", accessToken.substring(0, 10) + "...");
```

### 2. Logar parâmetros antes de cada requisição
Antes do `fetch`, adicionar:
```
console.log("Buscando pedidos com parâmetros:", { loja_id, data_inicial, data_final, page });
```

### 3. Capturar body do erro do Bling
Substituir o bloco `if (!res.ok)` (linhas 107-113) para capturar e logar o body da resposta de erro:
```typescript
if (!res.ok) {
  if (res.status === 429) {
    await sleep(2000);
    continue;
  }
  const errorBody = await res.text().catch(() => "");
  console.error("===== ERRO BLING =====");
  console.error("Status:", res.status);
  console.error("URL:", url);
  console.error("Resposta:", errorBody);
  console.error("======================");
  throw new Error(`Erro Bling ${res.status}: ${errorBody}`);
}
```

### 4. Após deploy
Invocar a função com uma busca real para capturar os logs e mostrar a resposta do Bling.

Nenhuma outra lógica será alterada.

