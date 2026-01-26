
## Plano: Mostrar Desconto no Bling (Itens + Total)

### Problema Atual

O pedido da **Igreja Batista Ibana Moura** está falhando com o erro:
> "O somatório do valor das parcelas difere do total da venda"

**Causa**: O Bling calcula internamente os valores aplicando desconto por item e arredonda de forma diferente do sistema, causando divergência de centavos entre o total calculado e a soma das parcelas.

### Análise Técnica

O código atual em `bling-create-order/index.ts` já envia:
- **Por item**: `valor` (preço cheio) + `desconto` (percentual %) - o Bling mostra na coluna "Desc (%)"
- **Desconto total calculado**: Variável `descontoTotalVenda` existe, mas NÃO é enviada ao Bling

A API do Bling aceita um campo `desconto` no nível do pedido (não só nos itens), que pode ser:
- Um **valor em reais** representando o desconto total da venda
- Isso aparece na nota fiscal e no resumo do pedido

### Solução Proposta

**Estratégia híbrida** para mostrar desconto em todos os níveis SEM erro de parcelas:

1. **Nos itens**: Enviar preço JÁ COM desconto aplicado no campo `valor` (não enviar desconto % por item)
2. **No pedido**: Enviar campo `desconto` com o valor TOTAL do desconto em reais
3. **Nas parcelas**: Calcular usando o total líquido (após desconto)

Isso garante:
- O desconto aparece no resumo do pedido Bling
- Os valores das parcelas batem exatamente com o total
- Não há recálculo interno do Bling que cause divergência

### Arquivos a Modificar

#### 1. `supabase/functions/bling-create-order/index.ts`

**Alteração nos itens (linha ~2082-2098):**
```typescript
// ANTES: Enviava preço cheio + desconto %
const itemBling = {
  codigo: skuRecebido,
  descricao: item.descricao,
  quantidade: quantidade,
  valor: precoLista,         // Preço cheio
  desconto: descontoPercentualItem,  // Bling recalcula
  produto: { id: blingProdutoId },
};

// DEPOIS: Enviar preço JÁ com desconto (valor líquido)
const itemBling = {
  codigo: skuRecebido,
  descricao: item.descricao,
  quantidade: quantidade,
  valor: precoUnitBlingSimulado,  // Preço COM desconto
  // Sem campo desconto por item
  produto: { id: blingProdutoId },
};
```

**Adicionar desconto no nível do pedido (linha ~2396):**
```typescript
const pedidoData = {
  numero: numeroPedido,
  data: new Date().toISOString().split('T')[0],
  loja: lojaPayload,
  contato: contatoPayload,
  itens: itensBling,
  naturezaOperacao: { id: naturezaOperacaoId },
  // NOVO: Desconto total da venda em reais
  desconto: {
    valor: descontoTotalVenda,  // Ex: 119.90 (valor em R$)
    unidade: 'REAL',            // Indica que é valor, não %
  },
  observacoes: observacoes,
  parcelas,
};
```

**Atualizar observações para incluir economia:**
```typescript
const observacoes = [
  `Pedido EBD #${pedido_id}`,
  `Economia total: R$ ${descontoTotalVenda.toFixed(2)}`,  // NOVO
  // ... resto das observações
].join(' | ');
```

### Como o Desconto Aparecerá no Bling

Após a alteração:
- **Resumo do Pedido**: Campo "Desconto" mostrará o valor total economizado
- **Nota Fiscal**: O desconto será considerado no cálculo fiscal
- **Parcelas**: Valores corretos sem divergência

### Impacto

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Desconto por item | Visível na coluna Desc(%) | Não visível por item |
| Desconto total | Não visível | Visível no resumo do pedido |
| Erro de parcelas | Frequente | Eliminado |
| Observações | Sem economia | Mostra "Economia: R$ X" |

### Passos de Implementação

1. Modificar montagem do `itemBling` para enviar `valor` líquido (sem campo `desconto`)
2. Adicionar campo `desconto` no payload `pedidoData` com valor total em R$
3. Incluir informação de economia nas observações
4. Testar aprovação do pedido "Igreja Batista Ibana Moura"
5. Verificar no Bling se o desconto aparece corretamente

### Validação

Após implementar, aprovar o pedido pendente e verificar:
- Pedido criado sem erro de parcelas
- Campo "Desconto" visível no resumo do pedido Bling
- Observações mostram o valor economizado
