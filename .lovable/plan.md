
# Plano: Validação de CPF com Aviso Claro + Correção do Cadastro

## Resumo do Problema
O cliente "Izaias de Moura Silva" (ID: `6e36c58a-d13f-4382-8c57-ad92e19d0510`) está com CPF inválido:
- **CPF atual:** `10492388000` (dígitos verificadores errados: `-00`)
- **CPF corrigido:** `10492388008` (dígitos verificadores corretos: `-08`)

O formulário de cadastro não valida matematicamente o CPF, permitindo que documentos inválidos sejam salvos.

---

## Mudanças Planejadas

### 1. Adicionar Funções de Validação de CPF/CNPJ
**Arquivo:** `src/components/vendedor/CadastrarClienteDialog.tsx`

Adicionar as funções `validateCPF` e `validateCNPJ` (que já existem em `CheckoutShopifyMP.tsx`) no início do arquivo:

```typescript
// Validação CPF (algoritmo oficial)
const validateCPF = (cpf: string): boolean => {
  const cleanCPF = cpf.replace(/\D/g, '');
  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cleanCPF[i]) * (10 - i);
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cleanCPF[i]) * (11 - i);
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleanCPF[10])) return false;
  return true;
};

// Validação CNPJ (algoritmo oficial)
const validateCNPJ = (cnpj: string): boolean => {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  if (cleanCNPJ.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(cleanCNPJ[i]) * weights1[i];
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleanCNPJ[12])) return false;
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(cleanCNPJ[i]) * weights2[i];
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  if (digit2 !== parseInt(cleanCNPJ[13])) return false;
  return true;
};
```

### 2. Adicionar Validação no Submit do Formulário
**Arquivo:** `src/components/vendedor/CadastrarClienteDialog.tsx`
**Local:** Dentro da função `handleSubmit`, após a validação de email (linha ~441)

```typescript
// Validar CPF/CNPJ matematicamente
const documentoLimpo = formData.documento.replace(/\D/g, "");
if (formData.possui_cnpj) {
  if (!validateCNPJ(documentoLimpo)) {
    toast.error("CNPJ inválido! Verifique os dígitos e tente novamente.");
    return;
  }
} else {
  if (!validateCPF(documentoLimpo)) {
    toast.error("CPF inválido! Verifique os dígitos e tente novamente.");
    return;
  }
}
```

### 3. Adicionar Estado para Erro de Documento em Tempo Real
**Arquivo:** `src/components/vendedor/CadastrarClienteDialog.tsx`

Adicionar estado para mostrar erro enquanto o usuário digita:

```typescript
const [documentoError, setDocumentoError] = useState<string | null>(null);
```

Atualizar `handleDocumentoChange` para validar em tempo real:

```typescript
const handleDocumentoChange = (value: string) => {
  const formatted = formData.possui_cnpj ? formatCNPJ(value) : formatCPF(value);
  setFormData({ ...formData, documento: formatted });
  
  // Validação em tempo real
  const limpo = formatted.replace(/\D/g, "");
  if (formData.possui_cnpj && limpo.length === 14) {
    setDocumentoError(validateCNPJ(limpo) ? null : "CNPJ inválido");
  } else if (!formData.possui_cnpj && limpo.length === 11) {
    setDocumentoError(validateCPF(limpo) ? null : "CPF inválido");
  } else {
    setDocumentoError(null);
  }
  
  // Reset Bling status when document changes
  if (formatted !== documentoJaBuscado) {
    setBlingClienteEncontrado(false);
    setBlingClienteId(null);
  }
};
```

### 4. Exibir Alerta Visual no Campo de Documento
**Arquivo:** `src/components/vendedor/CadastrarClienteDialog.tsx`

Adicionar indicador visual de erro abaixo do campo de documento:

```tsx
{documentoError && (
  <Alert variant="destructive" className="py-2">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription className="text-sm font-medium">
      {documentoError}! Verifique os dígitos verificadores.
    </AlertDescription>
  </Alert>
)}
```

### 5. Corrigir o CPF do Cliente no Banco de Dados
**Ação:** Executar UPDATE no banco para corrigir o CPF

```sql
UPDATE ebd_clientes 
SET cpf = '10492388008' 
WHERE id = '6e36c58a-d13f-4382-8c57-ad92e19d0510';
```

---

## Resumo dos Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/vendedor/CadastrarClienteDialog.tsx` | Adicionar validação CPF/CNPJ com feedback visual |
| Banco de dados (`ebd_clientes`) | Corrigir CPF do cliente específico |

---

## Resultado Esperado
1. O formulário de cadastro exibirá **"CPF inválido!"** ou **"CNPJ inválido!"** em tempo real quando os dígitos verificadores estiverem errados
2. O botão de salvar será bloqueado com mensagem de erro clara se o documento for inválido
3. O cliente "Izaias de Moura Silva" terá o CPF corrigido e poderá fazer pagamentos PIX normalmente
