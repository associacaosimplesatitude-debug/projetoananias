

## Correção: Peso exibido como 750kg ao invés de 750g

### Problema
A função `convertToKg` no `VendedorCalculadoraPeso.tsx` (linha 80-93) trata `weightUnit = null` como quilogramas (caso `default`). Quando a API do Shopify retorna `weight: 750` com `weightUnit: null` (ou um valor inesperado), o sistema interpreta como 750 **kg** ao invés de 750 **gramas**.

### Causa raiz
O produto no Bling tem peso bruto de 0,750 (kg). Ao ser sincronizado com Shopify, o valor pode ser armazenado como `750` (gramas) mas o campo `weightUnit` pode vir como `null` da Storefront API, fazendo o `default` do switch tratar como kg.

### Solução

**Arquivo: `src/pages/vendedor/VendedorCalculadoraPeso.tsx`** (linhas 79-93)

Atualizar a função `convertToKg` para:
1. Adicionar heurística: se `weight > 50` e a unidade é null/KILOGRAMS, provavelmente está em gramas (nenhum produto individual pesa 50+ kg)
2. Alternativamente, tratar `null` como `GRAMS` por padrão, já que a maioria dos produtos no Shopify armazena peso em gramas

A abordagem mais segura é a heurística:

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
      return weight;
    default:
      // Se unidade não informada e peso > 50, provavelmente está em gramas
      return weight > 50 ? weight / 1000 : weight;
  }
}
```

### Resultado
A Bíblia King James (750g) passará a exibir "750g" corretamente ao invés de "750.00kg".

