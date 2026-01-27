

# Plano: Corrigir Pedido no Bling com Desconto + Forma de Pagamento PIX

## Problema Identificado

O pedido foi criado no Bling com valor incorreto (R$ 1.598,63 ao invés de R$ 1.119,04) porque:

1. **Sem desconto**: A função `mp-sync-orphan-order` envia os itens com preço cheio (R$ 11,49 e R$ 14,99) sem calcular o preço com desconto de 30%
2. **Forma de pagamento errada**: Não está mapeando corretamente para "PIX"

### Dados Corretos do Pedido

| Item | Qtd | Preço Cheio | Desconto | Preço Líquido | Total |
|------|-----|-------------|----------|---------------|-------|
| ALUNO (31683) | 130 | R$ 11,49 | 30% | R$ 8,04 | R$ 1.045,20 |
| PROFESSOR (31684) | 7 | R$ 14,99 | 30% | R$ 10,49 | R$ 73,43 |
| **Total** | | | | | **R$ 1.118,63** |

O valor total no banco é R$ 1.119,04 (arredondamentos diferentes).

---

## Solução em Duas Partes

### Parte 1: Corrigir a Edge Function `mp-sync-orphan-order`

Modificar a conversão de itens para:
1. Calcular preço líquido (com desconto) para cada item
2. Enviar `preco_cheio` e `valor` corretamente
3. Garantir que forma de pagamento PIX seja reconhecida

**Código Atual (linha 124-131):**
```javascript
const itensBling = items.map((item: any) => ({
  codigo: item.sku || item.variantId || '0',
  descricao: item.title || 'Produto Shopify',
  unidade: 'UN',
  quantidade: item.quantity || 1,
  valor: Number(parseFloat(item.price || '0').toFixed(2)),
}));
```

**Código Corrigido:**
```javascript
const itensBling = items.map((item: any) => {
  const precoCheio = Number(parseFloat(item.price || '0').toFixed(2));
  const descontoPercentual = Number(item.descontoItem || 0);
  
  // Calcular preço líquido com desconto
  const precoLiquido = descontoPercentual > 0 
    ? Math.round(precoCheio * (1 - descontoPercentual / 100) * 100) / 100
    : precoCheio;

  return {
    codigo: item.sku || item.variantId || '0',
    descricao: item.title || 'Produto Shopify',
    unidade: 'UN',
    quantidade: item.quantity || 1,
    preco_cheio: precoCheio,  // Preço de tabela (sem desconto)
    valor: precoLiquido,       // Preço com desconto aplicado
  };
});
```

### Parte 2: Recriar o Pedido no Bling

Após corrigir a edge function, vou chamá-la novamente para criar o pedido corretamente:

```text
Cliente: Igreja Ministério Cristão da Família
CNPJ: 08509987000186
Endereço: Rua Hansenclever Santana, 115 - Santo Antônio - Manaus/AM - 69029140
Frete: Retirada (R$ 0,00)
Forma de Pagamento: PIX (Mercado Pago)

Itens (com 30% desconto):
  - 130x SKU 31683 @ R$ 8,04 (preço líquido)
  - 7x SKU 31684 @ R$ 10,49 (preço líquido)

Total: R$ 1.119,04
```

---

## Sequência de Execução

1. **Limpar dados antigos**: Resetar `bling_order_id` na tabela `ebd_shopify_pedidos_mercadopago`
2. **Atualizar a Edge Function**: Corrigir cálculo de desconto
3. **Deploy da Edge Function**: Aguardar deploy automático
4. **Recriar o Pedido**: Chamar `mp-sync-orphan-order` novamente

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/mp-sync-orphan-order/index.ts` | Corrigir cálculo de desconto nos itens |
| Tabela `ebd_shopify_pedidos_mercadopago` | Limpar `bling_order_id` para permitir recriação |

---

## Resultado Esperado

1. Pedido criado no Bling com valor correto: R$ 1.119,04
2. Desconto de 30% visível nas observações
3. Forma de pagamento: PIX
4. NF-e poderá ser emitida corretamente

