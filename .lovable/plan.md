

# Adicionar Comprovante e Renomear Campo no Modal de Pagamento

## Alteracoes em `src/components/royalties/PagamentoDialog.tsx`

### 1. Renomear "Data Prevista" para "Data do Pagamento"
Alterar o Label de "Data Prevista *" para "Data do Pagamento *".

### 2. Adicionar campo de upload de comprovante
- Importar o componente `ComprovanteUpload` ja existente
- Adicionar estado `comprovanteUrl` para armazenar o arquivo enviado
- Inserir o campo de upload apos "Observacoes"
- Incluir `comprovante_url` no insert do pagamento
- Resetar estado ao fechar o modal

### Resumo das alteracoes
- Label: "Data Prevista" -> "Data do Pagamento"
- Novo campo: Upload de comprovante usando componente existente
- Salvar comprovante junto com o pagamento na criacao
- Area do autor ja exibe comprovantes automaticamente

