
# Correção: Edge Function aprovar-faturamento não deployada

## Diagnóstico

Ao testar a aprovação de pedidos de faturamento na página `/admin/ebd/aprovacao-faturamento`, você recebe o erro **"Failed to send a request to the Edge Function"** porque a função `aprovar-faturamento` **não está deployada**.

### Evidência:
```
Teste direto da função aprovar-faturamento:
→ Status 404: "Requested function was not found"
→ Nenhum log encontrado (confirma que não está ativa)
```

### Pedidos afetados (confirmado no banco):
- ADVEC NILOPOLIS 2 (proposta: de468e71-715a-4f1e-9492-2659b884ceeb)
- IGREJA ASSEMBLEIA DE DEUS PODEROSO YAHWEH - A.D.P.Y (proposta: 0c919171-5050-4971-8f26-2b6aea96317d)

## Solução

### Fazer deploy da Edge Function aprovar-faturamento

1. Adicionar comentário de versão para forçar rebuild
2. Atualizar import do Supabase de `esm.sh` para `npm:` (mais estável)

```typescript
// v2 - deploy fix 2026-02-06
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
```

### Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/aprovar-faturamento/index.ts` | Adicionar comentário de versão e atualizar import |

## Verificação pós-deploy

Após o deploy, testar a aprovação diretamente na interface:
1. Acessar `/admin/ebd/aprovacao-faturamento`
2. Aprovar o pedido da ADVEC NILOPOLIS 2
3. Verificar que:
   - Pedido é criado no Bling
   - Status muda para FATURADO
   - Parcelas de comissão são criadas
