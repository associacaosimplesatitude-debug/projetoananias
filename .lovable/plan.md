
# Correção: Edge Function calculate-shipping não deployada

## Diagnóstico do Problema

O cálculo de frete automático está falhando porque a Edge Function `calculate-shipping` **não está deployada** no servidor.

### Evidências:
- Teste direto da função retorna **404 - "Requested function was not found"**
- Não há logs registrados para esta função (confirma que não está ativa)
- Os secrets `CORREIOS_USER` e `CORREIOS_PASSWORD` estão configurados corretamente

### Causa raiz:
A função existe no código fonte (`supabase/functions/calculate-shipping/index.ts`) mas nunca foi deployada ou o deploy expirou/falhou.

## Solução Proposta

### Fazer deploy da Edge Function

Adicionar um comentário no início do arquivo para forçar detecção de mudança e triggerar o deploy:

```typescript
// supabase/functions/calculate-shipping/index.ts
// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

### Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/calculate-shipping/index.ts` | Adicionar comentário para forçar deploy |

## Verificação pós-deploy

Após o deploy, testar a função com:
- CEP: 21810020 (Rio de Janeiro)
- Items com quantidade de produtos

A função deve retornar os valores de PAC e SEDEX calculados por região.

## Observação

O código da função está correto - utiliza uma tabela de preços por região baseada no CEP e calcula o frete considerando o peso total dos itens.
