

## Plano: Validação de Telefone no CadastrarClienteDialog

### Alterações no arquivo `src/components/vendedor/CadastrarClienteDialog.tsx`

**1. Criar função `validateTelefone`** (após `validarDocumento`, ~linha 324):
```typescript
const validateTelefone = (telefone: string): boolean => {
  const digits = telefone.replace(/\D/g, "");
  if (digits.length === 0) return true; // vazio é ok
  if (digits.length < 10 || digits.length > 11) return false;
  if (digits.substring(0, 2) === "00") return false;
  return true;
};
```

**2. Adicionar estado de erro** (junto aos outros estados, ~linha 194):
```typescript
const [telefoneError, setTelefoneError] = useState<string>("");
```

**3. No `handleSubmit`** (após validação de email TLD, ~linha 473): adicionar bloco que valida telefone se preenchido. Se inválido, seta `telefoneError` e retorna.

**4. Na busca Bling** (~linha 376): após preencher telefone do Bling, validar com `validateTelefone`. Se inválido, limpar o campo telefone e setar `telefoneError("Telefone inválido no Bling — preencha manualmente")`.

**5. No JSX do campo telefone** (~linha 931-935): adicionar `className` com borda vermelha condicional e exibir `{telefoneError && <p className="text-red-500 text-sm">{telefoneError}</p>}` abaixo do Input.

**6. Limpar erro** no `onChange` do telefone e no `resetForm`.

### Escopo
- 1 arquivo editado
- Nenhuma tabela, rota ou Edge Function alterada

