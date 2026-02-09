
# Plano: Botao Voltar no Royalties + Botao Liberar nas Atrasadas

## Problema 1: Botao "Voltar ao Painel Financeiro" no /royalties

O modulo de Royalties (`/royalties`) tem seu proprio layout com sidebar, sem nenhum botao para voltar ao painel administrativo principal. O usuario precisa de um botao "Voltar" no header para retornar ao painel financeiro.

### Solucao

Adicionar um botao "Voltar" no header do `RoyaltiesAdminLayout.tsx`, ao lado do `SidebarTrigger`. O botao usara o icone `ArrowLeft` e navegara para `/admin/ebd` (painel EBD/Financeiro).

**Arquivo:** `src/components/royalties/RoyaltiesAdminLayout.tsx`
- Importar `ArrowLeft` do lucide-react e `Link` do react-router-dom
- Adicionar botao com texto "Voltar" no header, antes do `SidebarTrigger`

---

## Problema 2: Botao "Liberar" nao aparece nas parcelas atrasadas

Quando o usuario clica no card "Atrasadas" no KPI, e direcionado para a aba "Pendentes" onde as parcelas atrasadas sao listadas. Porem, o botao "Liberar" nao aparece para itens com status `atrasada`.

### Causa

No componente `ComissaoTable.tsx`, a condicao para exibir o botao "Liberar" e:
```
["pendente", "agendada"].includes(item.comissao_status)
```
O status `atrasada` nao esta incluido nessa lista.

### Solucao

Adicionar `"atrasada"` a lista de status que permitem o botao "Liberar".

**Arquivo:** `src/components/admin/comissoes/ComissaoTable.tsx`
- Alterar a condicao na linha 297 para: `["pendente", "agendada", "atrasada"].includes(item.comissao_status)`

---

## Resumo das alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/royalties/RoyaltiesAdminLayout.tsx` | Adicionar botao "Voltar" no header com link para `/admin/ebd` |
| `src/components/admin/comissoes/ComissaoTable.tsx` | Incluir status "atrasada" na condicao do botao "Liberar" |
