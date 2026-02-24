

# Ajustes no Painel Financeiro Google

## 1. Dashboard visivel para o Financeiro

**Arquivo:** `src/components/admin/AdminEBDLayout.tsx`

Mover o item "Dashboard" (link para `/admin/ebd/google-ads`) de dentro do bloco `{!isFinanceiro && (...)}` para fora dele, junto com Notas Fiscais e Recargas, tornando-o visivel para todos os roles (admin, gerente_ebd e financeiro).

## 2. Periodo padrao: 7 dias

**Arquivo:** `src/pages/admin/GoogleAdsDashboard.tsx`

Alterar o estado inicial de `period` de `"today"` para `"7d"`, para que ao abrir o dashboard os dados dos ultimos 7 dias sejam exibidos por padrao.

## 3. Card de Saldo Atual + Botao Adicionar Saldo na pagina de Recargas

**Arquivo:** `src/pages/admin/GoogleRecargas.tsx`

- Adicionar uma query que soma os valores das recargas com status `CONFIRMADO` na tabela `google_ads_topups` para calcular o saldo total
- Exibir um Card grande e destacado no topo da pagina com o saldo atual formatado em R$
- Dentro do card, colocar um botao "Adicionar Saldo" que abre o modal de solicitar recarga (`setRequestOpen(true)`)

## Arquivos editados

1. `src/components/admin/AdminEBDLayout.tsx` -- mover Dashboard para fora do bloco isFinanceiro
2. `src/pages/admin/GoogleAdsDashboard.tsx` -- mudar periodo padrao para 7d
3. `src/pages/admin/GoogleRecargas.tsx` -- card de saldo + botao adicionar saldo
