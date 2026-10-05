# Editar cadastro de clientes EBD

## Implementação
- Alterar somente `src/pages/admin/AdminEBDClientes.tsx`.
- Usar o papel retornado por `useAuth` para exibir “Editar Cadastro” a `admin`, `gerente_ebd` e `financeiro`.
- Completar a interface local do cliente com os campos exigidos pelo formulário existente.
- Abrir `CadastrarClienteDialog` em modo de edição com o cliente selecionado e seu vendedor.
- Atualizar a lista após salvar, mantendo intactos os botões, filtros e demais áreas da tela.

## Validação
- Confirmar a compilação sem erros.
- Verificar que o botão e o formulário aparecem apenas nos papéis solicitados, sem alterar o acesso dos demais.
