

## Plano: Enviar pedido ADVEC ao Bling + Coluna Bling no painel + Correção definitiva

### 1. Enviar pedido ADVEC EST GUERENGUE CURICICA ao Bling

Chamar a edge function `mp-sync-orphan-order` com o `pedido_id: 2dd7dccf-bdd9-48cb-9ce1-21b58d5cbb6c`. Esta função já existe e faz exatamente isso:
- Busca dados completos do cliente (CPF/CNPJ)
- Chama `bling-create-order` com itens, endereço, vendedora
- Atualiza `bling_order_id` no registro MP
- Cria comissão para Elaine Ribeiro (se não existir)

### 2. Adicionar coluna "Bling" na tabela de Pedidos Confirmados

**Arquivo: `src/components/admin/AdminPedidosTab.tsx`**

- Adicionar `bling_order_id: string | null` na interface `ShopifyPedido` (linha ~77)
- Adicionar coluna "Bling" no `TableHeader` (entre "Vendedor" e "Rastreio", linha ~776)
- Adicionar célula no `TableBody` (~linha 828):
  - Badge verde com ID se `bling_order_id` preenchido
  - Badge vermelha "Não enviado" se null e pedido pago/faturado
  - "-" para pendentes

A query `select("*, vendedor:vendedores(nome)")` já retorna `bling_order_id` pois é `SELECT *`.

### 3. Corrigir bug definitivo no `mp-sync-payment-status`

**Arquivo: `supabase/functions/mp-sync-payment-status/index.ts`**

O problema: quando `bling-create-order` falha silenciosamente (timeout, erro 500, token OAuth expirado), o fluxo continua e marca o pedido como PAGO mas sem `bling_order_id`. Não há retry.

**Correção:**
- Após falha na chamada ao Bling, **não marcar como PAGO** — usar status intermediário `PAGO_SEM_BLING`
- Adicionar retry: se falhar, tentar novamente 1x após 2 segundos
- Se ainda falhar, registrar `sync_error` no pedido para visibilidade no painel
- Adicionar campo `sync_error` e `sync_retries` no update do pedido

**Arquivo: `src/components/admin/AdminPedidosTab.tsx`** (complemento)
- Na coluna Bling, pedidos com `sync_error` mostram badge amarela "Erro sync" com botão de retry manual

### Detalhes técnicos

```text
Fluxo atual (com bug):
  MP aprova → chama bling-create-order → FALHA SILENCIOSA → marca PAGO sem bling_order_id

Fluxo corrigido:
  MP aprova → chama bling-create-order → FALHA → retry 1x → FALHA
    → marca PAGO mas salva sync_error → visível no painel com botão retry
```

A migração de banco adiciona `sync_error TEXT` e `sync_retries INT DEFAULT 0` à tabela `ebd_shopify_pedidos_mercadopago`.

