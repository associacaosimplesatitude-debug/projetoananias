
# Corrigir Timeout na Sincronizacao de Vendas

## Problema

A Edge Function `bling-sync-royalties-sales` esta tentando processar 1355+ NF-es em uma unica chamada. Cada NF-e requer uma chamada a API do Bling com 400ms de delay, resultando em um tempo total de ~9 minutos. Edge Functions tem limite de ~60 segundos, causando timeout e o erro "Failed to send a request to the Edge Function".

Alem disso, o backfill de SKUs funcionou (27 livros preenchidos), mas a sincronizacao anterior rodou antes do backfill terminar, entao so 2 livros foram mapeados.

## Solucao: Sincronizacao em Lotes no Frontend

A Edge Function ja possui o parametro `skip` para paginacao. A solucao e fazer o frontend chamar a funcao em lotes pequenos (50 NF-es por vez), usando o retorno `total_nfes_available` para saber quando parar.

### Mudancas

**Arquivo: `src/components/royalties/BlingSyncButton.tsx`**

1. Alterar `handleSync` para fazer chamadas em loop:
   - Primeira chamada: `{ days_back, max_nfes: 50, skip: 0 }`
   - Retorno inclui `total_nfes_available` (ex: 1355)
   - Segunda chamada: `{ days_back, max_nfes: 50, skip: 50 }`
   - Continuar ate `skip >= total_nfes_available`
2. Mostrar progresso no botao (ex: "Sincronizando 50/1355...")
3. Aguardar 1 segundo entre lotes para evitar sobrecarga
4. Acumular resultados de todos os lotes para exibir no toast final

**Arquivo: `supabase/functions/bling-sync-royalties-sales/index.ts`**

1. Reduzir `maxNfes` default de 500 para 50 (para caber no timeout)
2. Separar a listagem de NFes da fase de processamento de detalhes:
   - A listagem (paginas de 100 NFes) e rapida (~15s para 20 paginas)
   - O processamento de detalhes (1 chamada por NFe) e o gargalo
3. Na primeira chamada (skip=0), fazer a listagem completa e retornar `total_nfes_available`
4. Nas chamadas seguintes (skip>0), reutilizar a listagem ja feita (ou refazer, que e rapido)

### Fluxo Resumido

```text
Frontend                          Edge Function
   |                                    |
   |-- POST {days: 42, max: 50, skip:0} -->|
   |                                    |-- Lista todas NFes (rapido)
   |                                    |-- Processa NFes 0-49 (detalhes)
   |<-- {total: 1355, synced: 50} ------|
   |                                    |
   | (aguarda 1s)                       |
   |                                    |
   |-- POST {days: 42, max: 50, skip:50}-->|
   |                                    |-- Lista NFes novamente
   |                                    |-- Processa NFes 50-99
   |<-- {total: 1355, synced: 50} ------|
   |                                    |
   | ... repete ate skip >= total ...    |
```

### Detalhes Tecnicos - BlingSyncButton.tsx

- Novo estado `progress: { current: number; total: number } | null`
- Loop while com `skip < total`:
  - Chamar `supabase.functions.invoke("bling-sync-royalties-sales", { body: { days_back, max_nfes: 50, skip } })`
  - Atualizar `progress` com skip atual e total
  - Incrementar skip += 50
  - Aguardar 1000ms entre chamadas
- No botao: mostrar "Sincronizando 150/1355..." durante o processo
- Toast final com total acumulado de todas as chamadas

### Detalhes Tecnicos - Edge Function

- Mudar default `maxNfes` para 50
- A funcao ja suporta `skip` e `max_nfes` - nao precisa de grandes mudancas
- Retorno ja inclui `total_nfes_available` - o frontend usa isso para saber quando parar
