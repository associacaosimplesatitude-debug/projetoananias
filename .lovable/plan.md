

# Ajustes no Modulo Financeiro Google

## 3 alteracoes solicitadas

### 1. Notas Fiscais -- Trocar texto de status PENDENTE (financeiro)

**Arquivo:** `src/pages/admin/GoogleNotasFiscais.tsx`

- Linha 236: Alterar o texto "Aguardando anexo do Admin" para "Aguardando emissao do Google Ads"

### 2. Notas Fiscais -- Remover botao "Solicitar Nota" (financeiro)

**Arquivo:** `src/pages/admin/GoogleNotasFiscais.tsx`

- Remover o bloco do botao "Solicitar Nota" (linhas 141-145) e a funcao `handleSolicitarNota` (linhas 130-132) que nao sao mais necessarios

### 3. Recargas -- Simplificar modal de solicitacao

**Arquivo:** `src/pages/admin/GoogleRecargas.tsx`

No modal "Solicitar Recarga" (linhas 318-346):
- Remover campo "Centro de Custo"
- Remover campo "Observacao"
- Adicionar campo "Data" (input type date, obrigatorio)
- Remover estado `reqCostCenter` e `reqNote`
- Adicionar estado `reqDate` (default: data de hoje)
- No insert, trocar `cost_center` e `request_note` por `requested_at: reqDate`

O modal ficara apenas com: **Valor (R$)** e **Data**.

## Resumo tecnico dos arquivos editados

1. `src/pages/admin/GoogleNotasFiscais.tsx` -- trocar texto + remover botao/funcao
2. `src/pages/admin/GoogleRecargas.tsx` -- simplificar modal (remover 2 campos, adicionar 1)

