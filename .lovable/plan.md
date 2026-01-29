

# Plano: Corrigir Cálculo de Royalties

## Problema Identificado

O registro de vendas existente mostra valores zerados:
- `valor_comissao_unitario`: R$ 0,00 (deveria ser R$ 1,12)
- `valor_comissao_total`: R$ 0,00 (deveria ser R$ 6,74)
- `valor_unitario`: R$ 49,90 (deveria usar R$ 22,45 - valor de capa)

**Cálculo correto:**
R$ 22,45 (valor capa) × 5% (comissão) × 6 (unidades) = **R$ 6,74**

## Causas

1. A Edge Function usa o valor da NFe (`item.valor = 49.90`) em vez do valor de capa
2. O percentual de comissão pode estar vindo como string ou zero

---

## Correções Necessárias

### 1. Corrigir Edge Function (`bling-sync-royalties-sales`)

**Linha 253-255 - Usar valor de capa para royalties:**

```typescript
// ANTES (errado):
const valorUnitario = item.valor || item.valorUnidade || bookInfo.preco_capa;
const valorComissaoUnitario = valorUnitario * (bookInfo.percentual_comissao / 100);

// DEPOIS (correto):
const valorVenda = item.valor || item.valorUnidade || bookInfo.preco_capa;
const valorParaRoyalties = bookInfo.preco_capa; // Sempre usar valor de capa
const percentual = Number(bookInfo.percentual_comissao) || 0;
const valorComissaoUnitario = valorParaRoyalties * (percentual / 100);
```

**Linha 139 - Garantir conversão numérica:**

```typescript
// ANTES:
const percentual = book.royalties_comissoes?.[0]?.percentual || 0;

// DEPOIS:
const percentual = Number(book.royalties_comissoes?.[0]?.percentual) || 0;
```

### 2. Corrigir Registro Existente no Banco

Atualizar a venda já importada com os valores corretos:

```sql
UPDATE royalties_vendas 
SET 
  valor_unitario = 22.45,
  valor_comissao_unitario = 1.1225,
  valor_comissao_total = 6.74
WHERE livro_id = 'b8563451-31ea-4335-ac5c-6c3605ed81a8'
  AND bling_order_id = 24945872934;
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-sync-royalties-sales/index.ts` | Usar valor_capa para royalties + conversão numérica |

---

## Seção Técnica

### Lógica de Cálculo de Royalties

A regra de negócio (já documentada em memória) é:
```
Valor Royalty = Valor de Capa × (% Comissão / 100) × Quantidade
```

Portanto:
- R$ 22,45 × 0,05 × 6 = **R$ 6,74**

### Mudanças no Código

**Função `loadBooksWithBlingId` - garantir número:**
```typescript
const percentual = Number(book.royalties_comissoes?.[0]?.percentual) || 0;
const precoCapa = Number(book.valor_capa) || 0;

const mapping: BookMapping = {
  livro_id: book.id,
  bling_produto_id: book.bling_produto_id.toString(),
  percentual_comissao: percentual,
  preco_capa: precoCapa,
};
```

**Função `syncNFeBatch` - usar valor capa:**
```typescript
const quantidade = item.quantidade || 1;
// Usar SEMPRE o valor de capa para cálculo de royalties
const valorUnitario = bookInfo.preco_capa;
const valorComissaoUnitario = valorUnitario * (bookInfo.percentual_comissao / 100);
const valorComissaoTotal = valorComissaoUnitario * quantidade;
```

---

## Resultado Esperado

Após as correções:
1. O card "Royalties a Pagar" mostrará **R$ 6,74**
2. Futuras sincronizações calcularão corretamente
3. O cálculo seguirá a regra: Valor Capa × % Comissão × Quantidade

