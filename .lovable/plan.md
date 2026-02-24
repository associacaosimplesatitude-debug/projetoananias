

# Adicionar Botão "Editar" nas Notas Fiscais

## O que será feito

Adicionar um botão "Editar" (ícone de lápis) na coluna de Ações da tabela de Notas Fiscais, visível apenas para Admin, que abre o `InvoiceUploadModal` com os dados da nota pré-preenchidos para edição (número, data, valor, observação, e opcionalmente substituir o PDF).

## Alterações

### 1. `src/pages/admin/GoogleNotasFiscais.tsx`

- Importar ícone `Pencil` do lucide-react
- Adicionar botão "Editar" na coluna de Ações (Admin only), visível para qualquer status exceto CANCELADA
- Ao clicar, abre o modal com `openUpload(inv, 'edit')` passando o invoice existente e um novo modo `'edit'`
- Adicionar `'edit'` ao tipo do estado `uploadMode`

### 2. `src/components/google/InvoiceUploadModal.tsx`

- Aceitar modo `'edit'` além de `'create'` e `'replace'`
- No modo `'edit'`: pré-preencher os campos com dados da nota existente, o PDF é opcional (só substitui se um novo arquivo for selecionado), e o status não muda ao salvar
- Título do modal: "Editar Nota Fiscal"
- Botão de submit: "Salvar"

