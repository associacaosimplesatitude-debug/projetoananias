

## Plano: Confirmar Pagamento Cartão de Crédito — Livraria Foco Gospel

### Resumo

Adicionar botão "Confirmar Pagamento" para propostas com status `AGUARDANDO_PAGAMENTO` na aba "Propostas Digitais". Ao clicar, o sistema envia o pedido ao Bling com forma de pagamento **cartão de crédito**, atualiza o status para `PAGO`, e gera as parcelas de comissão do vendedor.

### Alterações em `src/pages/admin/AdminEBDPropostasPage.tsx`

**1. Nova função `handleConfirmarPagamentoMP`**

Reutiliza a mesma lógica de `processFaturamento` (montar cliente, itens, endereço), mas com diferenças:
- `forma_pagamento: 'credito'` (cartão de crédito) em vez de `'FATURAMENTO'`
- Sem `faturamento_prazo`
- Atualiza status para `PAGO` em vez de `FATURADO`
- Após sucesso no Bling, gera parcela de comissão (1 parcela, à vista, vencimento = hoje) usando a mesma lógica de `aprovarComissaoMutation`:
  - Busca `comissao_percentual` do vendedor
  - Insere em `vendedor_propostas_parcelas` com `origem: 'mercado_pago'`, `status: 'aguardando'`
  - Marca `comissao_aprovada: true` na proposta

**2. Botão na UI**

Para propostas com `status === "AGUARDANDO_PAGAMENTO"`, renderizar:
```
[✓ Confirmar Pagamento] (botão verde)
```
Visível para admin, gerente_ebd e financeiro. Mostra spinner enquanto processa.

### Resultado

- Proposta sai de "Propostas Digitais" → aparece em "Pedidos Confirmados" com status `PAGO`
- Pedido criado no Bling com forma de pagamento cartão de crédito
- Comissão da vendedora (Neila) gerada automaticamente
- Funcionalidade reutilizável para futuras confirmações manuais

