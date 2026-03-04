

## Problemas Identificados

### 1. Duplicação E-commerce
Pedidos como "Miriam Candido" aparecem **duas vezes**: uma vez em `ebd_shopify_pedidos` (rotulado "B2B") e outra em `ebd_shopify_pedidos_cg` (rotulado "E-commerce CG"). O código busca ambas as tabelas sem deduplicar.

### 2. B2B sem vendedor
Pedidos em `ebd_shopify_pedidos` que não têm `cliente_id` nem `vendedor_id` e cujo `customer_email` não bate com nenhum `email_superintendente` em `ebd_clientes` caem no fallback: canal "B2B", vendedor "—". Muitos desses são na verdade pedidos e-commerce que existem em ambas as tabelas.

---

## Solução

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`**

1. **Buscar E-commerce CG primeiro** e coletar os `customer_email` (lowercase) num `Set`.

2. **Ao processar `ebd_shopify_pedidos`**, pular qualquer pedido cujo `customer_email` já esteja no Set de CG (mesmo dia = já deduplicado pelo filtro de data). Isso elimina duplicatas.

3. Resultado: pedidos e-commerce aparecem apenas uma vez como "E-commerce CG", e os pedidos genuínos B2B continuam aparecendo normalmente com seus vendedores.

