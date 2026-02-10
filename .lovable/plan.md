
# Remover campo "Termos do Contrato" do formulario de Contratos

## Resumo

Remover o campo de texto "Termos do Contrato" do dialog de criacao/edicao de contratos (`ContratoDialog.tsx`).

## Alteracoes

### `src/components/royalties/ContratoDialog.tsx`

1. Remover o import de `Textarea` (se nao for usado em outro lugar)
2. Remover `termos_contrato` do estado `formData` (inicializacao e reset)
3. Remover `termos_contrato` do payload de submit
4. Remover o bloco JSX do campo "Termos do Contrato" (linhas 358-374 - o Label + Textarea)

O campo `termos_contrato` continuara existindo na tabela do banco de dados, apenas nao sera mais exibido no formulario.
