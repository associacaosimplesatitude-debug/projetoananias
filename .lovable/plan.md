# Corrigir detecção de números EUA em /admin/ebd/revista-licencas

## Problema

Em `src/pages/admin/RevistaLicencasAdmin.tsx`, a função `detectWhatsappCountry` (linha 370) só classifica como EUA números de 11 dígitos começando com `"10"`. Mas códigos de área dos EUA nunca começam com 0 ou 1 — começam com 2-9 (ex.: 305 Miami, 617 Boston, 781 Boston, 813 Tampa, 857 Boston).

Resultado: clientes reais como `17815586729`, `13057265041`, `16174617575`, `18132155420` etc. estão sendo exibidos com bandeira do Brasil e formato `+55 (17) 8155-86729`.

## Causa da ambiguidade

Tanto BR (11 dígitos, DDDs 11–19) quanto EUA (11 dígitos, prefixo `1` + área 2-9) começam com `1`. A regra discriminante é: **um celular brasileiro de 11 dígitos sempre tem o 3º dígito igual a `9`** (DDD + `9` + 8 dígitos). Se o 3º dígito não é `9`, não pode ser BR mobile — é EUA.

Exemplos validados na base:
- `15991616340` (DDD 15, 9...) → BR ✓
- `16981648852` (DDD 16, 9...) → BR ✓
- `17815586729` (3º dígito = 8) → EUA (área 781) ✓
- `13057265041` (3º dígito = 0) → EUA (área 305) ✓
- `16174617575` (3º dígito = 7) → EUA (área 617) ✓

## Mudança

Atualizar **apenas** `detectWhatsappCountry` em `src/pages/admin/RevistaLicencasAdmin.tsx` (linhas 370–374):

```ts
function detectWhatsappCountry(digits: string): "BR" | "PT" | "US" {
  if (digits.startsWith("351") && digits.length === 12) return "PT";
  // EUA: 11 dígitos começando com "1". Diferenciamos de BR mobile (que sempre
  // tem o 3º dígito = "9", pois é DDD + 9 + 8 dígitos).
  if (digits.length === 11 && digits.startsWith("1") && digits[2] !== "9") return "US";
  return "BR";
}
```

`formatWhatsappDisplay` já trata o caso US corretamente (`+1 (XXX) XXX-XXXX`), então nenhuma outra alteração é necessária.

## Escopo

- 1 arquivo, 1 função, ~3 linhas alteradas.
- Sem migração de banco, sem mudança de UI/layout, sem alteração no valor armazenado.
