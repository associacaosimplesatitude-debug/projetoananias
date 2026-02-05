

# Correção: Edge Function bling-search-client não deployada

## Diagnóstico do Problema

A busca de cliente no Bling não está funcionando porque a Edge Function `bling-search-client` **não está deployada** no ambiente de produção.

### Evidências encontradas:
- **Console do navegador**: `FunctionsFetchError: Failed to send a request to the Edge Function`
- **Teste direto**: Retorna 404 - "Requested function was not found"
- **Logs da função**: Nenhum log encontrado (confirma que não está ativa)

### Causa raiz:
Os deploys estão falhando com "Bundle generation timed out" - um problema temporário de infraestrutura.

## Solução Proposta

### 1. Forçar redeploy da função
Adicionar um comentário insignificante no código para forçar nova detecção de mudança e tentar deploy:

```typescript
// supabase/functions/bling-search-client/index.ts
// Linha 1: Adicionar comentário com timestamp
// v2 - redeploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

### 2. Verificar após deploy
- Testar chamada direta à edge function
- Confirmar que busca de cliente funciona no painel do vendedor

## Arquivos a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/bling-search-client/index.ts` | Adicionar comentário para forçar redeploy |

## Observação técnica
Se o timeout persistir, pode ser necessário aguardar alguns minutos para que a infraestrutura se estabilize, pois o erro "Bundle generation timed out" indica problema temporário no serviço de deploy.

