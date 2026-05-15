## Objetivo

1. Garantir que números dos EUA sempre apareçam como `+1 (XXX) XXX-XXXX` e PT como `+351 XXX XXX XXX`, sem regressões para BR.
2. Criar testes automatizados cobrindo BR, EUA e Portugal para `detectWhatsappCountry` e `formatWhatsappDisplay`.

## Mudanças

### 1. Extrair util reutilizável e testável

Criar `src/lib/whatsappFormat.ts` com:

- `detectWhatsappCountry(digits): "BR" | "PT" | "US"`
- `formatWhatsappDisplay(raw): { country, formatted }`

Manter regras atuais e reforçar a detecção dos EUA:
- PT: 12 dígitos iniciando com `351`.
- US: 11 dígitos iniciando com `1` e 3º dígito ≠ `9` (evita colidir com celular BR `DDD+9+8`). Também aceitar 10 dígitos cujo 1º dígito (código de área) seja `2-9` **e** que não sejam um DDD brasileiro válido — manteremos conservador: só promove a US quando começa com `1` (11 dígitos), pois é o formato armazenado pelos pedidos Shopify dos EUA na base.
- BR: demais casos.

Formatação:
- US: `+1 (XXX) XXX-XXXX` sempre que `country === "US"`, mesmo com dígitos parciais (preencher só o que existe, sem deixar parênteses vazios).
- PT: `+351 XXX XXX XXX`.
- BR: mantém `+55 (DD) XXXXX-XXXX` / `+55 (DD) XXXX-XXXX`.

### 2. Atualizar `RevistaLicencasAdmin.tsx`

Remover as definições locais de `detectWhatsappCountry` / `formatWhatsappDisplay` e importar de `@/lib/whatsappFormat`. Sem mudanças de UI.

### 3. Setup de testes (se ainda não existir)

Conferir se o projeto já tem Vitest configurado. Caso não:
- Adicionar `vitest`, `@testing-library/jest-dom`, `@testing-library/react`, `jsdom` como devDeps.
- Criar `vitest.config.ts` e `src/test/setup.ts` conforme guia padrão.

(Nesta task só precisamos do runner — não há render de componente.)

### 4. Testes — `src/lib/whatsappFormat.test.ts`

Casos cobertos:

**detectWhatsappCountry**
- `"351922211394"` → `PT`
- `"17815586729"`, `"13057265041"`, `"16174617575"` → `US`
- `"15991616340"` (DDD 15, celular SP) → `BR` (3º dígito = 9)
- `"16981648852"` → `BR`
- `"1133334444"` (10 dígitos, fixo SP) → `BR`
- `"5511999998888"` (com DDI) → `BR` (fallback)
- string vazia / curta → `BR` (fallback de segurança)

**formatWhatsappDisplay**
- `"17815586729"` → `+1 (781) 558-6729`, country `US`
- `"13057265041"` → `+1 (305) 726-5041`
- `"351922211394"` → `+351 922 211 394`, country `PT`
- `"15991616340"` → `+55 (15) 99161-6340`, country `BR`
- `"1133334444"` → `+55 (11) 3333-4444`
- `""` → `{ country: null, formatted: "—" }`

## Arquivos

- novo: `src/lib/whatsappFormat.ts`
- novo: `src/lib/whatsappFormat.test.ts`
- editar: `src/pages/admin/RevistaLicencasAdmin.tsx` (remover funções locais, importar do util)
- (condicional) novo: `vitest.config.ts`, `src/test/setup.ts`, devDeps de teste

## Validação

Rodar `vitest run src/lib/whatsappFormat.test.ts` e conferir que todos os casos passam. Abrir `/admin/ebd/revista-licencas` e confirmar que números US aparecem com `+1 (...)` e PT com `+351 ...`.
