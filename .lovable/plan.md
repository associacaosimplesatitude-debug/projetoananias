

## Plano: Validação de CPF/CNPJ no cadastro de clientes

### Problema
Clientes são cadastrados com CNPJ/CPF inválido (tanto manualmente pelo vendedor quanto importados do Bling), e o erro só aparece na hora de faturar.

### Solução
Adicionar validação matemática de CPF/CNPJ em dois momentos no `CadastrarClienteDialog`:

**1. Validação em tempo real (feedback visual)**
- Quando o documento está completo (11 ou 14 dígitos), rodar `validateCPF`/`validateCNPJ` do `royaltiesValidators.ts`
- Se inválido, mostrar mensagem de erro vermelha abaixo do campo: "CPF inválido" ou "CNPJ inválido"
- Borda vermelha no input

**2. Bloqueio no submit**
- No `handleSubmit`, antes de salvar, validar o documento
- Se inválido, mostrar `toast.error` e impedir o cadastro/edição
- Funciona tanto para cadastro novo quanto edição

**3. Dados vindos do Bling**
- Após preencher com dados do Bling (linha ~357), validar o documento retornado
- Se inválido, mostrar aviso amarelo: "⚠️ CNPJ importado do Bling é inválido — corrija antes de salvar"
- Não bloqueia o preenchimento, mas bloqueia o submit

### Arquivo modificado
`src/components/vendedor/CadastrarClienteDialog.tsx`
- Importar `validateCPF`, `validateCNPJ` de `@/lib/royaltiesValidators`
- Adicionar estado `documentoErro` para feedback visual
- Validar no `handleDocumentoChange` e após retorno do Bling
- Validar no `handleSubmit` antes de prosseguir
- Renderizar erro abaixo do campo de documento

