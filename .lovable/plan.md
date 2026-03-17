

## Diagnóstico

O erro **não é de sessão expirada**. A resposta HTTP é **409 Conflict** com a mensagem:

```
duplicate key value violates unique constraint "ebd_clientes_cpf_unique_not_null"
```

**Causa raiz**: Existem 2 cadastros duplicados da "Rosangela Silva" na carteira da Neila:

| ID | CPF | Email | Criado em |
|---|---|---|---|
| `93dd8b9d...` | **NULL** | patrickvideocf@gmail.com | 11/fev |
| `71bdb635...` | **01769949470** | aquinorosangela772@gmail.com | 02/mar |

A vendedora está editando o cadastro `93dd8b9d` (que tem CPF nulo) e tentando salvar o CPF `017.699.494-70`, mas esse CPF já existe no cadastro `71bdb635`. O constraint `ebd_clientes_cpf_unique_not_null` impede a duplicação.

## Plano

### 1. Melhorar o tratamento do erro 23505 no modo edição

Atualmente, o `catch` genérico na linha 697-699 apenas mostra "Erro ao atualizar cliente". O tratamento de duplicidade (linhas 588-661) só existe para o modo de **cadastro novo**.

**Arquivo**: `src/components/vendedor/CadastrarClienteDialog.tsx`

No bloco de edição (linhas 534-541), após o `if (error) throw error;`, interceptar o erro `23505` antes do throw:

```typescript
if (isEditMode && clienteParaEditar) {
  const { error } = await supabase
    .from("ebd_clientes")
    .update(clienteData)
    .eq("id", clienteParaEditar.id);

  if (error) {
    if (error.code === "23505") {
      // Duplicate CPF/CNPJ
      const docLabel = formData.possui_cnpj ? "CNPJ" : "CPF";
      toast.error(`Este ${docLabel} já está cadastrado em outro cliente. Verifique antes de salvar.`);
      setLoading(false);
      return;
    }
    throw error;
  }
  // ... rest of edit logic
}
```

This gives a clear, actionable message instead of a generic error.

### 2. (Dados) Limpar o cadastro duplicado

Os dois registros pertencem à mesma vendedora. O cadastro antigo (`93dd8b9d`, sem CPF) provavelmente deve ser removido ou unificado manualmente. Não farei isso automaticamente — apenas melhorarei a mensagem para que a vendedora saiba exatamente o que está acontecendo.

