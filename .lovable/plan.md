

## Correção: Countdown do primeiro sorteio

### Problema
A sessão começa às 14:00 com intervalo de 60 min. O código calcula o próximo sorteio começando em `inicio` (14:00), mas o primeiro sorteio real deve ser às 15:00 (início + intervalo). Atualmente o loop em `proximoSorteio` (linha 191-192) começa com `proximo = inicio`, tratando 14:00 como um slot válido de sorteio.

### Solução

**Arquivo: `src/pages/public/SorteioLanding.tsx`** (linha 191)

Mudar o ponto de partida para `inicio + intervalo`:

```typescript
let proximo = inicio + intervalo;
```

Assim, para uma sessão das 14:00 às 18:00 com intervalo de 60 min, os slots serão: 15:00, 16:00, 17:00, 18:00 — e não 14:00, 15:00, 16:00, etc.

**Também verificar a mesma lógica na edge function `sorteio-automatico/index.ts`** (linhas 51-53), onde o cálculo do slot segue a mesma estrutura. Atualmente:
```typescript
let proximoSlot = inicio;
while (proximoSlot < nowMs) proximoSlot += intervaloMs;
```
Deve ser:
```typescript
let proximoSlot = inicio + intervaloMs;
while (proximoSlot < nowMs) proximoSlot += intervaloMs;
```

Isso garante que o backend e o frontend concordem: o primeiro sorteio é sempre `início + intervalo`.

