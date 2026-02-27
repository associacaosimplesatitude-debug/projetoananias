

## Plano: Corrigir pedido #2690 e limpar matches incorretos

### 1. Corrigir pedido #2690
Remover o `vendedor_id` e `cliente_id` incorretos (Neila / "Igreja do Evangelho Quadrangular") do pedido #2690, já que o email `eduardo8487@yahoo.com.br` não pertence a nenhum cliente cadastrado.

### 2. Identificar e corrigir outros pedidos com match incorreto
Existem **116 pedidos** onde o email do pedido não bate com o email do cliente vinculado — potenciais matches feitos pelo fuzzy name que foi removido. Vou limpar esses pedidos removendo `vendedor_id` e `cliente_id` que foram atribuídos incorretamente por fuzzy match (sem match por email ou documento).

**Abordagem:** Executar UPDATE no banco para setar `vendedor_id = NULL` e `cliente_id = NULL` nos pedidos onde:
- O email do pedido é diferente do email do cliente vinculado
- Não há match por CPF/CNPJ entre pedido e cliente

Isso desfaz os matches incorretos por nome. Pedidos que foram atribuídos manualmente pelo admin podem ser re-atribuídos depois.

### 3. A correção preventiva já foi feita
O Método 3 (fuzzy name) já foi removido do webhook na última edição. A função de sync (`ebd-shopify-sync-orders`) não usa fuzzy match — ela só extrai vendedor/cliente de `note_attributes` e tags. Nenhuma alteração de código adicional é necessária.

### Detalhes técnicos
- **Tabela afetada:** `ebd_shopify_pedidos`
- **Pedidos afetados:** ~116 registros com email mismatch
- **Campos alterados:** `vendedor_id → NULL`, `cliente_id → NULL` (apenas nos que não têm match real)

