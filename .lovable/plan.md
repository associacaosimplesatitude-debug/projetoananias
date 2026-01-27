
# Plano: Corrigir Pedido Sem Bling - Igreja Ministério Cristão da Família

## Diagnóstico Completo

### Dados do Pedido
| Campo | Valor |
|-------|-------|
| ID Pedido MP | c2739317-ac53-440d-a32f-1bcbc062c952 |
| ID Proposta | 3b3baa45-2843-4fdc-b513-4df6c1216284 |
| Cliente | Igreja Ministério Cristão da Família |
| CNPJ | 08.509.987/0001-86 |
| Vendedora | Elaine Ribeiro |
| Valor Total | R$ 1.119,04 |
| Status | PAGO (approved) |
| Payment ID MP | 143597662750 |
| Data Pagamento | 26/01/2026 às 19:05 |
| **Bling Order ID** | **NULL** (problema!) |

### Itens do Pedido
- 130x Revista EBD N67 Maturidade Cristã ALUNO (SKU: 31683) - R$ 11,49 c/ 30% desc
- 7x Revista EBD N67 Maturidade Cristã PROFESSOR (SKU: 31684) - R$ 14,99 c/ 30% desc

### Causa do Problema
O webhook do Mercado Pago atualizou o status para PAGO, mas a chamada para criar o pedido no Bling falhou. Não há logs disponíveis do horário exato (26/01 às 19:05) para identificar o erro específico.

---

## Solução Proposta

### Passo 1: Criar Pedido Manualmente no Bling
Chamar a edge function `bling-create-order` com os dados do pedido para criar o pedido no Bling retroativamente.

### Passo 2: Atualizar as Tabelas
Após criar o pedido no Bling:
1. Atualizar `ebd_shopify_pedidos_mercadopago.bling_order_id`
2. Atualizar `vendedor_propostas.bling_order_id`
3. Atualizar `vendedor_propostas_parcelas.bling_order_id`

### Passo 3: Adicionar Fallback no Código (Prevenção)
Criar um mecanismo para detectar pedidos PAGOS sem `bling_order_id` e reprocessá-los automaticamente.

---

## Ação Imediata (Correção Manual)

Vou executar a criação do pedido no Bling chamando a edge function com os dados corretos do pedido:

```text
Cliente: Igreja Ministério Cristão da Família
CNPJ: 08509987000186
Endereço Entrega: Rua Hansenclever Santana, 115 - Santo Antônio - Manaus/AM - 69029140
Frete: Retirada (R$ 0,00)
Itens:
  - 130x SKU 31683 @ R$ 11,49 (30% desc)
  - 7x SKU 31684 @ R$ 14,99 (30% desc)
Total: R$ 1.119,04
Forma: PIX (Mercado Pago)
```

---

## Resumo das Alterações

| Local | Ação |
|-------|------|
| Edge Function `bling-create-order` | Chamar manualmente com dados do pedido |
| Tabela `ebd_shopify_pedidos_mercadopago` | Atualizar `bling_order_id` |
| Tabela `vendedor_propostas` | Atualizar `bling_order_id` |
| Tabela `vendedor_propostas_parcelas` | Atualizar `bling_order_id` |

## Resultado Esperado
1. Pedido será criado no Bling com número de rastreamento
2. NF-e poderá ser emitida normalmente
3. Comissão da vendedora Elaine será vinculada ao pedido Bling
