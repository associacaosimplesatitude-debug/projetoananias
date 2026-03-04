

## Plano: Comissão ALFAMARKETING (3% do faturamento bruto total)

### Resumo

Criar uma nova página/menu **"Comissão AlfaMarketing"** dentro do painel admin, acessível **apenas para admin geral** (`role === 'admin'`). Essa página calcula 3% sobre o valor bruto de todos os canais de venda do sistema, com controle de período mensal, status de pagamento e detalhamento por canal.

### Canais de Faturamento (fontes de dados)

| Canal | Tabela | Filtro |
|---|---|---|
| B2B Faturado (Shopify Draft) | `ebd_shopify_pedidos` | status_pagamento IN ('Pago','paid','Faturado') |
| Mercado Pago | `ebd_shopify_pedidos_mercadopago` | status = 'PAGO' |
| E-commerce (Central Gospel) | `ebd_shopify_pedidos_cg` | status_pagamento IN ('paid','Pago','Faturado') |
| Propostas Vendedores | `vendedor_propostas` | status IN ('FATURADO','PAGO') |
| PDV Balcão | `vendas_balcao` | status = 'finalizada' |
| ADVECS | `bling_marketplace_pedidos` | marketplace = 'ADVECS' |
| Atacado | `bling_marketplace_pedidos` | marketplace = 'ATACADO' |
| Amazon | `bling_marketplace_pedidos` | marketplace = 'AMAZON' |
| Shopee | `bling_marketplace_pedidos` | marketplace = 'SHOPEE' |
| Mercado Livre | `bling_marketplace_pedidos` | marketplace = 'MERCADO_LIVRE' |

### Regra de Negócio da Comissão

- **Percentual**: 3% do valor bruto
- **Período**: Mês calendário (dia 01 ao último dia)
- **Liberação**: Pedidos faturados em parcelas — a comissão de 3% sobre o valor total da parcela fica **pendente** até que a parcela seja paga. Quando paga, a comissão é **liberada**.
- Para pedidos à vista (e-commerce, marketplaces, balcão), a comissão é liberada imediatamente.
- Campo **"Comissão Paga"**: permite marcar como paga com data de pagamento.

### Estrutura da Página

1. **Filtro de período** (date picker mês/ano) — padrão: mês atual (dia 01 a último dia)
2. **Cards por canal** — cada canal mostra:
   - Valor bruto faturado no período
   - Comissão (3%)
   - Status (pendente / liberada / paga)
3. **Card Total** — soma de todos os canais
4. **Tabela de comissões por mês** — histórico com colunas:
   - Mês referência
   - Valor bruto total
   - Comissão (3%)
   - Status (Pendente → Liberada → Paga)
   - Data pagamento
   - Ação: marcar como paga

### Mudanças Técnicas

1. **Tabela no banco**: `comissoes_alfamarketing`
   - `id`, `mes_referencia` (date), `canal` (text), `valor_bruto` (numeric), `valor_comissao` (numeric), `status` (text: pendente/liberada/paga), `pago_em` (timestamptz), `created_at`, `updated_at`
   - RLS: apenas admin pode ler/escrever

2. **Nova página**: `src/pages/admin/ComissaoAlfaMarketing.tsx`
   - Consulta direta às tabelas de vendas agrupando por canal e período
   - Cards visuais por canal + total
   - Tabela de histórico mensal
   - Botão "Marcar como Paga"

3. **Rota**: `/admin/ebd/comissao-alfamarketing` no `App.tsx`

4. **Menu lateral**: Novo item em `AdminEBDLayout.tsx`, visível **apenas para `isAdmin`**, no grupo Financeiro

5. **Sem alteração** em `GestaoComissoes.tsx` — é uma página separada

