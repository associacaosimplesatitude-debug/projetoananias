

## Correções na Comissão AlfaMarketing

### Problema 1: Card "Total do Mês" sem valor total de vendas e comissão destacados
O card Total existe mas precisa ser mais claro, mostrando o valor total de vendas e a comissão separadamente com destaque visual. Atualmente já mostra, mas vou verificar se está renderizando corretamente — o card está no código (linhas 398-435). Na verdade o card já existe e mostra ambos. O problema pode ser visual. Vou adicionar mais destaque.

**Ação**: Verificar se o card Total está visível e melhorar destaque visual se necessário.

### Problema 2: Lista de pedidos sem link das Notas Fiscais
A tabela do drill-down não inclui coluna de NF. A tabela `ebd_shopify_pedidos` tem campos `nota_fiscal_numero`, `nota_fiscal_url` e `status_nfe`, mas o select das queries não busca esses campos e a interface `OrderDetail` tem `nf` opcional que nunca é preenchido.

**Ação**:
- Adicionar `nota_fiscal_numero, nota_fiscal_url, status_nfe` ao select de `ebd_shopify_pedidos` em todos os cases do drill-down
- Adicionar coluna "NF" na tabela do dialog com link clicável para `nota_fiscal_url`
- Para `vendas_balcao` e `bling_marketplace_pedidos` também buscar campos de NF equivalentes

### Problema 3: Pessoa Física, Revendedores e Representantes sem lista de pedidos
O `fetchShopifyByTipo` funciona, mas:
- **Revendedores e Representantes**: O RPC soma dados de `vendedor_propostas` (propostas faturadas/pagas) mas o drill-down só busca em `ebd_shopify_pedidos` e `ebd_shopify_pedidos_mercadopago`. Falta buscar também na tabela `vendedor_propostas` com join em `ebd_clientes`.
- **Pessoa Física**: O filtro "PESSOA" pode não bater com o valor real do `tipo_cliente`. Precisa também buscar "FISICA" e "PF" no mesmo loop, mas o mais provável é que o `tipo_cliente` real seja algo como "Pessoa Física" (com acento) e a comparação `.toUpperCase().includes("PESSOA")` deveria funcionar. Preciso verificar se existem dados.

**Ação**:
- Nos cases `revendedores` e `representantes`, adicionar query à tabela `vendedor_propostas` com join em `ebd_clientes` filtrando por `tipo_cliente`
- No case `pessoa_fisica`, garantir que busca por "PESSOA", "FISICA" e "PF" sem duplicatas
- Garantir que o `fetchShopifyByTipo` também inclui os campos de NF

### Arquivo modificado
`src/pages/admin/ComissaoAlfaMarketing.tsx`

