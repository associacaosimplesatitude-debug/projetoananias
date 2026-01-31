
# Plano: Corrigir Mapeamento de Forma de Envio na Loja Penha

## Problema Identificado

Quando você escolheu **"Retirada na Matriz"** na interface da Loja Penha, o sistema enviou `retirada_penha` para o Bling, resultando em:
- **ID Serviço Logístico**: `retirada_penha` (não reconhecido pelo Bling)
- **Observações**: Serviço `retirada_penha` 

### Causa Raiz (2 partes):

**1. Frontend (ShopifyPedidos.tsx linha 1566):**
O código está **hardcoded** para sempre enviar `metodo_frete: 'retirada_penha'`:
```typescript
metodo_frete: 'retirada_penha',  // ← Sempre envia isso!
```
Não importa o que você escolheu na interface, sempre vai como `retirada_penha`.

**2. Backend (bling-create-order/index.ts linhas 2127-2133):**
O mapeamento `tipoFreteMap` não inclui `retirada_penha` nem `retirada_pe`:
```typescript
const tipoFreteMap = {
  'pac': { nome: 'Correios', servico: 'PAC' },
  'sedex': { nome: 'Correios', servico: 'SEDEX' },
  'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
  'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
  // ❌ Falta: 'retirada_penha' e 'retirada_pe'
};
```
Como resultado, o fallback envia o valor literal `retirada_penha` como serviço logístico.

---

## Solução

### Parte 1: Corrigir o Frontend (ShopifyPedidos.tsx)

Atualmente a página de Pedidos da Loja Penha (ShopifyPedidos.tsx) não permite ao vendedor escolher a forma de entrega. O `metodo_frete` está fixo.

**Opção A (Recomendada):** Permitir escolha da forma de envio com base no depósito:
- Se `deposito_origem === 'local'` (Penha) → `metodo_frete: 'retirada_penha'`
- Se `deposito_origem === 'matriz'` → `metodo_frete: 'retirada'`
- Se `deposito_origem === 'pernambuco'` → `metodo_frete: 'retirada_pe'`

**Opção B:** Adicionar o componente `FormaEnvioSection` ao fluxo de pagamento na loja.

### Parte 2: Corrigir o Backend (bling-create-order/index.ts)

Adicionar os novos valores ao mapeamento:

```typescript
const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
  'pac': { nome: 'Correios', servico: 'PAC' },
  'sedex': { nome: 'Correios', servico: 'SEDEX' },
  'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
  'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
  'retirada_penha': { nome: 'Retirada Loja Penha', servico: 'RETIRADA_PENHA' },
  'retirada_pe': { nome: 'Retirada Polo Pernambuco', servico: 'RETIRADA_PE' },
};
```

---

## Detalhes Técnicos

### Arquivo 1: `src/pages/shopify/ShopifyPedidos.tsx`

**Linha 1566 - DE:**
```typescript
metodo_frete: 'retirada_penha',
```

**PARA (baseado no depósito selecionado):**
```typescript
metodo_frete: pagamentoData.depositoOrigem === 'local' ? 'retirada_penha' 
            : pagamentoData.depositoOrigem === 'matriz' ? 'retirada' 
            : 'retirada_pe',
```

### Arquivo 2: `supabase/functions/bling-create-order/index.ts`

**Linhas 2127-2132 - DE:**
```typescript
const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
  'pac': { nome: 'Correios', servico: 'PAC' },
  'sedex': { nome: 'Correios', servico: 'SEDEX' },
  'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
  'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
};
```

**PARA:**
```typescript
const tipoFreteMap: { [key: string]: { nome: string; servico: string } } = {
  'pac': { nome: 'Correios', servico: 'PAC' },
  'sedex': { nome: 'Correios', servico: 'SEDEX' },
  'free': { nome: 'Correios', servico: 'PAC CONTRATO AG' },
  'retirada': { nome: 'Retirada na Matriz', servico: 'RETIRADA' },
  'retirada_penha': { nome: 'Retirada Loja Penha', servico: 'RETIRADA_PENHA' },
  'retirada_pe': { nome: 'Retirada Polo PE', servico: 'RETIRADA_PE' },
};
```

---

## Resultado Esperado

| Depósito Origem | metodo_frete enviado | Serviço no Bling |
|-----------------|---------------------|------------------|
| local (Penha)   | `retirada_penha`    | `RETIRADA_PENHA` |
| matriz          | `retirada`          | `RETIRADA`       |
| pernambuco      | `retirada_pe`       | `RETIRADA_PE`    |

A escolha do vendedor (Matriz, Penha ou PE) será respeitada e aparecerá corretamente no Bling.

---

## Impacto

- **Pedidos novos**: Aparecerão com o serviço logístico correto
- **Pedidos antigos**: Permanecem como estão (sem correção retroativa)
- **Roteamento de estoque**: Já funciona corretamente (linhas 1537-1582 do backend)
