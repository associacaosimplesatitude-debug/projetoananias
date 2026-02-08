
# Plano: Corrigir Exibição de Comissões Pagas para o Vendedor

## Problema Identificado

O clique no botão "Pagar" **funcionou corretamente** no banco de dados:
- A parcela `cf7e986b-e447-4a05-bd35-2e7797f0389c` foi atualizada para `comissao_status: 'paga'` e `comissao_paga_em: '2026-02-08 18:31:43'`

Porém, a tela do vendedor (`ComissaoPrevisaoCard.tsx`) **não mostra a comissão como paga** porque:

1. **Interface incompleta**: A interface `Parcela` não inclui os campos `comissao_status` e `comissao_paga_em`
2. **Filtro incorreto**: O código filtra por `p.status === 'paga'` (status do pagamento do cliente) ao invés de `p.comissao_status === 'paga'` (status do pagamento da comissão ao vendedor)

---

## Campos na Tabela

```text
vendedor_propostas_parcelas:
├── status: 'paga'|'aguardando'|'atrasada' (pagamento DO CLIENTE)
└── comissao_status: 'pendente'|'agendada'|'liberada'|'paga' (pagamento AO VENDEDOR)
```

---

## Mudanças Planejadas

### 1. Atualizar Interface Parcela
**Arquivo:** `src/components/vendedor/ComissaoPrevisaoCard.tsx`

Adicionar os campos faltantes na interface:

```tsx
interface Parcela {
  // ... campos existentes ...
  status: string;
  origem: string;
  comissao_status: string;      // ADICIONAR
  comissao_paga_em: string | null; // ADICIONAR
}
```

### 2. Corrigir Filtros de Status
**Arquivo:** `src/components/vendedor/ComissaoPrevisaoCard.tsx`

| Linha | Antes | Depois |
|-------|-------|--------|
| 68 | `p.status === 'paga'` | `p.comissao_status === 'paga'` |
| 72 | `p.status !== 'paga'` | `p.comissao_status !== 'paga'` |
| 84 | `p.status !== 'paga'` | `p.comissao_status !== 'paga'` |
| 103 | `p.status === 'paga'` | `p.comissao_status === 'paga'` |
| 109 | `p.status === 'paga'` | `p.comissao_status === 'paga'` |
| 114 | `p.status === 'paga'` | `p.comissao_status === 'paga'` |

---

## Fluxo Corrigido

```text
╔══════════════════════════════════════════════════════════════╗
║  ADMIN: Clica "Pagar" na comissão                            ║
╠══════════════════════════════════════════════════════════════╣
║  1. PATCH vendedor_propostas_parcelas                        ║
║     - comissao_status = 'paga'                               ║
║     - comissao_paga_em = timestamp                           ║
║                                                              ║
║  2. toast.success("Comissão marcada como paga!")             ║
║                                                              ║
║  3. invalidateQueries → atualiza lista                       ║
╚══════════════════════════════════════════════════════════════╝
                         │
                         ▼
╔══════════════════════════════════════════════════════════════╗
║  VENDEDOR: Tela de Comissões                                 ║
╠══════════════════════════════════════════════════════════════╣
║  Query busca parcelas com vendedor_id                        ║
║                                                              ║
║  Filtro CORRIGIDO:                                           ║
║  - comissao_status === 'paga' → "Comissão Recebida no Mês"   ║
║  - comissao_status !== 'paga' → "Pendente no mês"            ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Resultado Esperado

Após a correção:

1. Quando o admin clicar em "Pagar", a comissão será atualizada no banco
2. A tela do vendedor exibirá corretamente:
   - **"Comissão Recebida no Mês"**: soma das comissões com `comissao_status === 'paga'`
   - **"Recebidas: X parcelas"**: contagem correta de parcelas pagas
   - **"Pendente no mês"**: mostra apenas comissões ainda não pagas

---

## Detalhes Técnicos

### Alteração no ComissaoPrevisaoCard.tsx

**Interface atualizada (linhas 16-29):**
```tsx
interface Parcela {
  id: string;
  proposta_id: string;
  vendedor_id: string;
  cliente_id: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  valor_comissao: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  origem: string;
  comissao_status: string;
  comissao_paga_em: string | null;
}
```

**Filtros corrigidos:**

```tsx
// Linha 67-69: Comissão recebida no mês
const comissaoRecebidaMes = parcelasDoMes
  .filter(p => p.comissao_status === 'paga')
  .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

// Linha 71-73: Comissão pendente no mês
const comissaoPendenteMes = parcelasDoMes
  .filter(p => p.comissao_status !== 'paga')
  .reduce((sum, p) => sum + Number(p.valor_comissao || 0), 0);

// Linha 82-85: Previsões futuras
const parcelasDoMesAlvo = parcelas.filter(p => {
  const vencimento = parseISO(p.data_vencimento);
  return vencimento >= inicioMes && vencimento <= fimMes && p.comissao_status !== 'paga';
});

// Linha 102-106: Parcelas atrasadas
const parcelasAtrasadas = parcelasDoMes.filter(p => {
  if (p.comissao_status === 'paga') return false;
  const vencimento = parseISO(p.data_vencimento);
  return isBefore(vencimento, hoje);
}).length;

// Linha 108-112: Parcelas aguardando
const parcelasAguardando = parcelasDoMes.filter(p => {
  if (p.comissao_status === 'paga') return false;
  const vencimento = parseISO(p.data_vencimento);
  return isAfter(vencimento, hoje) || format(vencimento, 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd');
}).length;

// Linha 114: Contagem de parcelas pagas
const parcelasPagas = parcelasDoMes.filter(p => p.comissao_status === 'paga').length;
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/vendedor/ComissaoPrevisaoCard.tsx` | Adicionar `comissao_status` e `comissao_paga_em` na interface `Parcela` |
| `src/components/vendedor/ComissaoPrevisaoCard.tsx` | Trocar 6 ocorrências de `status` por `comissao_status` nos filtros |
