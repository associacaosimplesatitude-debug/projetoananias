

# Plano: Corrigir Soma do Total Geral do Dashboard

## Problema Identificado

O Total Geral está mostrando **R$ 25.284,21** quando deveria ser aproximadamente **R$ 17.152,97**.

### Causa Raiz
O frontend está usando `periodMetrics.valorIgrejas` (que vem de `igrejas_total`) na soma do Total Geral. Porém, `igrejas_total` já é a soma de:
- Igreja CNPJ
- Igreja CPF  
- Lojistas

Mas os cards individuais de Igreja CNPJ, Igreja CPF e Lojistas **não estão sendo somados** no Total. Em vez disso, o valor agregado `igrejas_total` está sendo usado, o que gera:

| O que está somando | Valor |
|-------------------|-------|
| E-commerce | R$ 2.641,53 |
| **Igrejas Total (ERRO)** | R$ 17.002,15 |
| Shopee | R$ 61,80 |
| Mercado Livre | R$ 89,02 |
| ADVECS | R$ 4.787,82 |
| Revendedores | R$ 701,89 |
| **TOTAL ERRADO** | **R$ 25.284,21** |

### O Correto Deveria Ser

| O que deve somar | Valor |
|-----------------|-------|
| E-commerce | R$ 2.641,53 |
| Igreja CNPJ | R$ 6.999,84 |
| Igreja CPF | R$ 0,00 |
| Lojistas | R$ 1.871,07 |
| Pessoa Física | R$ 0,00 |
| Amazon | R$ 0,00 |
| Shopee | R$ 61,80 |
| Mercado Livre | R$ 89,02 |
| ADVECS | R$ 4.787,82 |
| Revendedores | R$ 701,89 |
| Atacado | R$ 0,00 |
| Representantes | R$ 0,00 |
| **TOTAL CORRETO** | **R$ 17.152,97** |

## Solução

### Arquivo: `src/components/admin/SalesChannelCards.tsx`

Modificar o cálculo de `totalGeral` para somar os valores individuais em vez do agregado:

**Antes (ERRADO):**
```typescript
const valorTotal = 
  periodMetrics.valorOnline + 
  periodMetrics.valorIgrejas +  // <-- ERRADO: igrejas_total duplica
  periodMetrics.valorPessoaFisica +
  ...
```

**Depois (CORRETO):**
```typescript
const valorTotal = 
  periodMetrics.valorOnline + 
  periodMetrics.valorIgrejasCNPJ +    // Igreja CNPJ individual
  periodMetrics.valorIgrejasCPF +      // Igreja CPF individual
  periodMetrics.valorLojistas +        // Lojistas individual
  periodMetrics.valorPessoaFisica +
  ...
```

---

## Seção Técnica

### Linha a Modificar

Arquivo `src/components/admin/SalesChannelCards.tsx`, linhas 292-318:

Alterar de:
```typescript
const totalGeral = useMemo(() => {
  const valorTotal = 
    periodMetrics.valorOnline + 
    periodMetrics.valorIgrejas +           // <-- REMOVER
    periodMetrics.valorPessoaFisica +
    ...
```

Para:
```typescript
const totalGeral = useMemo(() => {
  const valorTotal = 
    periodMetrics.valorOnline + 
    periodMetrics.valorIgrejasCNPJ +       // <-- ADICIONAR
    periodMetrics.valorIgrejasCPF +        // <-- ADICIONAR
    periodMetrics.valorLojistas +          // <-- ADICIONAR
    periodMetrics.valorPessoaFisica +
    ...
```

A mesma mudança deve ser feita para `qtdTotal`.

### Resultado Esperado

Após a correção:
- Total Geral mostrará aproximadamente R$ 17.152,97 para 02/02
- Os valores individuais continuarão aparecendo corretamente em cada card
- Não haverá mais duplicação de valores na soma

