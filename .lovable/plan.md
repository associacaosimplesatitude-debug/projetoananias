
# Correção: NF-e não está herdando o desconto do pedido Bling

## Diagnóstico

A análise do código revela que:

1. O **pedido no Bling está correto** - a imagem mostra que o desconto está sendo aplicado:
   - Total dos itens: R$ 20,00
   - Desconto total da venda: R$ 4,00
   - Total da venda: R$ 16,00

2. O código em `bling-generate-nfe` tenta herdar o desconto do pedido (linhas 530-543), mas **não há log de debug mostrando o valor de `pedido.desconto` que vem da API do Bling**.

3. O log existente (linhas 383-394) não inclui o campo `desconto`, então não sabemos se ele está vindo na resposta da API.

## Causa Provável

A API do Bling retorna o campo `desconto` na resposta GET do pedido, mas o código não está lendo corretamente porque:

- O campo pode ter estrutura diferente na resposta real (ex: `pedido.desconto` vs `pedidoDataDetect.data.desconto`)
- O log de debug não inclui esse campo para verificar

## Solução

### 1. Adicionar Log de Debug Completo

Adicionar log do campo `desconto` do pedido para verificar se está chegando:

```typescript
console.log(`[BLING-NFE] ✓ Pedido #${pedido?.numero} pronto para gerar NF-e`, {
  contatoId: pedido?.contato?.id,
  contatoNome: pedido?.contato?.nome,
  // ... outros campos existentes ...
  desconto: pedido?.desconto, // NOVO: Verificar se desconto está vindo
  total: pedido?.total,
  totalProdutos: pedido?.totalProdutos,
});
```

### 2. Log Antes da Verificação do Desconto

Adicionar log explícito para debug:

```typescript
// Log ANTES de verificar o desconto
console.log(`[BLING-NFE] DEBUG: pedido.desconto =`, JSON.stringify(pedido?.desconto));

if (pedido.desconto) {
  // ... código existente
}
```

### 3. Fallback: Calcular Desconto a partir dos Totais

Se o Bling não retornar o campo `desconto`, podemos calculá-lo:

```typescript
// Calcular desconto a partir da diferença entre totalProdutos e total
if (!descontoGlobalPedido && pedido.totalProdutos && pedido.total) {
  const descontoCalculado = Number(pedido.totalProdutos) - Number(pedido.total);
  if (descontoCalculado > 0.01) {
    descontoGlobalPedido = {
      valor: descontoCalculado,
      unidade: 'REAL',
    };
    console.log(`[BLING-NFE] ✓ Desconto CALCULADO: R$ ${descontoCalculado.toFixed(2)} (totalProdutos - total)`);
  }
}
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-generate-nfe/index.ts` | Adicionar logs de debug e fallback para calcular desconto |

## Fluxo Corrigido

```text
1. Buscar pedido no Bling
2. LOG: Mostrar estrutura completa do campo desconto
3. Tentar ler pedido.desconto (estrutura documentada)
4. FALLBACK: Calcular desconto = totalProdutos - total
5. Adicionar desconto ao payload da NF-e
6. NF-e é criada COM desconto
7. DANFE mostra valor correto
```

## Resultado Esperado

Após essa correção:
- Logs mostrarão exatamente o que está vindo do Bling
- Se `pedido.desconto` existir, será usado
- Se não existir, o desconto será calculado matematicamente
- A NF-e sempre terá o desconto correto
