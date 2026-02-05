

# Correção: Checkout Mercado Pago com Carrinho Vazio

## Diagnóstico do Problema

O checkout do Mercado Pago exibe **"Carrinho Vazio"** porque a Edge Function `mp-checkout-init` **não está deployada**.

### Fluxo do Problema:
1. Cliente clica em "Pagar" na página da proposta (`/proposta/77861356-7665-49f3-bc7a-ce7af17efb84`)
2. É redirecionado para `/ebd/checkout-shopify-mp?proposta=77861356-7665-49f3-bc7a-ce7af17efb84`
3. A página `CheckoutShopifyMP` chama a função `mp-checkout-init` para buscar os dados da proposta
4. **A função retorna 404** → Não consegue carregar os itens → "Produtos (0)" e "Carrinho Vazio"

### Evidência:
```
Teste direto da função mp-checkout-init:
→ Status 404: "Requested function was not found"
→ Nenhum log encontrado (confirma que não está ativa)
```

### Dados da Proposta (confirmados no banco):
- Token: `77861356-7665-49f3-bc7a-ce7af17efb84`
- Cliente: Igreja Batista de Vila Araçá
- Produtos: 1 item (Revista EBD Cordeirinhos de Jesus - R$13.99)
- Frete: R$10.45
- **Os dados existem** - só não estão sendo carregados porque a função não está deployada

## Solução

### Fazer deploy da Edge Function mp-checkout-init

Adicionar um comentário no início do arquivo para forçar o deploy:

```typescript
// supabase/functions/mp-checkout-init/index.ts
// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
```

### Arquivo a modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/mp-checkout-init/index.ts` | Adicionar comentário para forçar deploy |

## Verificação pós-deploy

1. Testar chamada direta à função com o token da proposta
2. Acessar novamente o link `https://gestaoebd.com.br/proposta/77861356-7665-49f3-bc7a-ce7af17efb84`
3. Clicar em "Pagar" e verificar que os produtos aparecem corretamente
4. O checkout deve mostrar:
   - 1 produto (Revista EBD)
   - Valor de R$13.99 
   - Frete R$10.45
   - Total correto

