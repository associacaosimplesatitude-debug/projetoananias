

## Plano: Seção "Vendas de Hoje" na Comissão AlfaMarketing

### O que será feito
Adicionar uma nova seção **"Vendas de Hoje"** logo abaixo do Histórico de Comissões. Essa seção mostra todas as vendas realizadas no dia atual, com colunas: **Vendedor**, **Canal**, **Valor**, **Comissão (3%)**.

### Mudanças Técnicas

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`**

1. **Nova query `vendas-hoje`**: Buscar vendas do dia (00:00 até agora) em todas as tabelas de vendas:
   - `ebd_shopify_pedidos` (B2B) — tem `vendedor_id`, buscar nome no `vendedores`
   - `ebd_shopify_pedidos_mercadopago` — tem `vendedor_nome` direto
   - `ebd_shopify_pedidos_cg` (E-commerce) — tem `vendedor_id`, buscar nome
   - `vendedor_propostas` — tem `vendedor_nome` direto
   - `vendas_balcao` — tem `vendedor_id`, buscar nome
   - `bling_marketplace_pedidos` (ADVECS, Atacado) — sem vendedor, exibir "—"

2. **Buscar nomes de vendedores**: Fazer um fetch único na tabela `vendedores` (id, nome) e mapear por ID para evitar N+1 queries.

3. **Nova seção UI**: Card com tabela contendo colunas:
   - Vendedor (nome)
   - Canal (B2B, Mercado Pago, E-commerce CG, PDV Balcão, ADVECS, etc.)
   - Cliente
   - Valor
   - Comissão (3%)

4. **Posição**: Após o card "Histórico de Comissões" (depois da linha 615).

