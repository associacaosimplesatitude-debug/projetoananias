## Problema

Números brasileiros com DDD `11` (ex.: `11947141878` — SP, 11 dígitos começando com `1`) estão sendo classificados como EUA porque a heurística atual diz "11 dígitos começando com `1` = EUA". Como DDDs brasileiros vão de `11` a `99`, **todo celular de SP, RJ e Espírito Santo** (DDDs 11, 12, 13, 14, 15, 16, 17, 18, 19) está aparecendo como 🇺🇸.

## Correção

Arquivo: `src/pages/admin/RevistaLicencasAdmin.tsx` (linhas 367–371)

Restringir a detecção de EUA: só classificar como US quando os dois primeiros dígitos forem `10` (DDI `+1` + area code começando com `0`). Como **nenhum DDD brasileiro começa com `0`** (vão de 11 a 99), `10XXXXXXXXX` nunca colide com BR. Os DDDs `11`–`19` continuam corretamente como Brasil.

```ts
function detectWhatsappCountry(digits: string): "BR" | "PT" | "US" {
  if (digits.startsWith("351") && digits.length === 12) return "PT";
  // US: 11 dígitos começando com "10" (DDI 1 + area code 0XX). Evita confundir
  // com DDDs brasileiros 11–19 que também começam com "1".
  if (digits.length === 11 && digits.startsWith("10")) return "US";
  return "BR";
}
```

## Trade-off conhecido

Area codes americanos reais começam com 2–9 (não com 0 nem 1), então tecnicamente nenhum número US válido casa com `10XXXXXXXXX`. Na prática isso significa que **números US armazenados sem prefixo explícito ficarão como BR**. Se aparecer um cliente real dos EUA, o ideal é armazenar com DDI `+1` mais explícito (ex.: salvar como `001XXXXXXXXXX` ou marcar país no banco). Por ora, priorizamos corrigir o caso brasileiro que afeta dezenas de licenças reais.

## Resultado

- `11947141878` → 🇧🇷 +55 (11) 94714-1878 ✅
- `21987654321` → 🇧🇷 +55 (21) 98765-4321 ✅
- `351938048481` → 🇵🇹 +351 938 048 481 ✅ (sem mudança)
