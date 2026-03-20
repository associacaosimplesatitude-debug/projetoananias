

## Correção: Heurística de peso também para `KILOGRAMS`

### Problema
O produto "Bíblia King James - Preta" retorna `weightUnit: "KILOGRAMS"` com `weight: 750` da API Shopify. A heurística atual só cobre o caso `default` (unidade null), mas não o caso `KILOGRAMS`. Como nenhum produto individual pesa 50+ kg, o valor 750 com unidade "KILOGRAMS" está claramente em gramas.

A variante "Cobre" provavelmente retorna `weightUnit: null`, por isso já foi corrigida pela heurística anterior. A "Preta" retorna `KILOGRAMS` explicitamente, entrando no `case 'KILOGRAMS': return weight` sem nenhuma verificação.

### Solução

**Arquivo: `src/pages/vendedor/VendedorCalculadoraPeso.tsx`** (linhas 80-94)

Aplicar a mesma heurística no caso `KILOGRAMS`: se `weight > 50`, tratar como gramas.

```typescript
function convertToKg(weight: number | null, unit: string | null): number {
  if (!weight) return 0;
  switch (unit) {
    case 'GRAMS':
      return weight / 1000;
    case 'OUNCES':
      return weight * 0.0283495;
    case 'POUNDS':
      return weight * 0.453592;
    case 'KILOGRAMS':
      return weight > 50 ? weight / 1000 : weight;
    default:
      return weight > 50 ? weight / 1000 : weight;
  }
}
```

Uma única linha alterada (linha 90).

