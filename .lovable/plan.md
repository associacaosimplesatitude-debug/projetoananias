

## Correções na Comissão AlfaMarketing

### Problemas Identificados

1. **Propostas Vendedores duplicando B2B**: Propostas com status FATURADO/PAGO já viram pedidos na `ebd_shopify_pedidos` (B2B Faturado). Estão sendo contados duas vezes. Remover o card "Propostas Vendedores".

2. **ADVECS zerado**: A página só consulta `bling_marketplace_pedidos` com marketplace='ADVECS', mas o dashboard real soma também pedidos de `ebd_shopify_pedidos` e `ebd_shopify_pedidos_mercadopago` onde o `tipo_cliente` do cliente contém 'ADVEC'. Precisa replicar a mesma lógica do RPC `get_sales_channel_totals`.

3. **Canais faltando**: Pessoa Física, Representantes, Igreja CNPJ, Igreja CPF, Revendedores, Lojistas — todos existem no dashboard de vendas mas não na página de comissão.

4. **Remover Amazon, Shopee, Mercado Livre**: AlfaMarketing não recebe comissão desses canais.

5. **Cards clicáveis com lista de pedidos**: Ao clicar num card, abrir dialog/tabela com detalhes dos pedidos (Cliente, Tipo, Data, Valor Compra, Comissão 3%, Status, NF) — similar ao que já existe na gestão de comissões.

### Mudanças Técnicas

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`** (reescrever as queries)

**Canais corretos** (sem Amazon, Shopee, ML, sem Propostas):
- **B2B Faturado**: `ebd_shopify_pedidos` (status_pagamento IN Pago/paid/Faturado)
- **Mercado Pago**: `ebd_shopify_pedidos_mercadopago` (status = PAGO)
- **E-commerce CG**: `ebd_shopify_pedidos_cg` (status_pagamento IN paid/Pago/Faturado)
- **PDV Balcão**: `vendas_balcao` (status = finalizada)
- **ADVECS**: `bling_marketplace_pedidos` WHERE marketplace='ADVECS' + `ebd_shopify_pedidos` JOIN `ebd_clientes` WHERE tipo_cliente LIKE '%ADVEC%' + `ebd_shopify_pedidos_mercadopago` JOIN `ebd_clientes` WHERE tipo_cliente LIKE '%ADVEC%' + `vendedor_propostas` JOIN `ebd_clientes` WHERE tipo_cliente = 'Igreja' (propostas_advecs)
- **Atacado**: `bling_marketplace_pedidos` WHERE marketplace='ATACADO'
- **Igreja CNPJ**: `ebd_shopify_pedidos` + `ebd_shopify_pedidos_mercadopago` JOIN `ebd_clientes` WHERE tipo_cliente LIKE '%IGREJA%CNPJ%'
- **Igreja CPF**: mesma lógica com '%IGREJA%CPF%'
- **Lojistas**: mesma lógica com '%LOJISTA%'
- **Pessoa Física**: mesma lógica com '%PESSOA%' ou '%FISICA%' ou '%PF%'
- **Revendedores**: `vendedor_propostas` + shopify + MP JOIN ebd_clientes WHERE tipo_cliente LIKE '%REVENDEDOR%'
- **Representantes**: mesma lógica com '%REPRESENTANTE%'

**Nova funcionalidade — Dialog de detalhes por canal**:
- Criar estado `selectedChannel` para abrir dialog
- Ao clicar no card, abrir dialog que faz query dos pedidos individuais do canal
- Tabela com colunas: Cliente, Tipo, Data, Valor Compra, Comissão (3%), Status, NF
- Buscar dados das tabelas correspondentes ao canal selecionado, incluindo join com `ebd_clientes` para nome

**Usar RPC `get_sales_channel_totals`**: Em vez de fazer 12+ queries manuais, reutilizar a RPC existente que já calcula tudo corretamente. Isso garante que os valores batam com o dashboard de vendas. A query de totais fica uma única chamada RPC.

**Arquivo: `comissoes_alfamarketing` table**: Atualizar os canais salvos (remover amazon/shopee/ml/propostas, adicionar os novos canais).

