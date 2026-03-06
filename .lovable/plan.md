

## Plano: Sincronizar Itens dos 617 Pedidos Faltantes

### Situação Atual
- **1.844** pedidos pagos no total
- **1.227** já têm itens sincronizados
- **617** pedidos sem itens (todos com `shopify_order_id` válido)
- A função `ebd-shopify-sync-order-items` atual processa **1 pedido por vez**

### O que será feito

**Criar uma nova Edge Function `ebd-shopify-sync-order-items-batch`** que:

1. Busca todos os pedidos pagos que **não têm itens** na tabela `ebd_shopify_pedidos_itens`
2. Processa em lotes de **5 pedidos por vez** (para respeitar rate limits da Shopify API — máximo ~2 req/s)
3. Para cada pedido, chama a Shopify Admin API para buscar os `line_items`
4. Faz upsert dos itens na tabela `ebd_shopify_pedidos_itens`
5. Retorna um relatório com: total processado, sucesso, falhas

**Detalhes técnicos:**
- Rate limit: delay de 500ms entre cada chamada à Shopify API
- Processamento em lotes de 5 para evitar timeout da Edge Function (máximo ~25s de execução)
- Se houver mais de ~50 pedidos por execução, a função retorna o progresso e precisa ser chamada múltiplas vezes
- Limite prático: ~50 pedidos por execução (25s ÷ 500ms = 50 chamadas)
- Serão necessárias ~13 execuções para cobrir os 617 pedidos

**Fluxo de execução:**
1. Deploy da nova função batch
2. Chamar a função repetidamente até processar todos os 617 pedidos
3. Validar o resultado com query de contagem

### Arquivos
- **Novo:** `supabase/functions/ebd-shopify-sync-order-items-batch/index.ts`

