

## Plano: Mostrar nome do cliente que já usa o CPF/CNPJ

### Alteração

**`src/components/vendedor/CadastrarClienteDialog.tsx`** — linhas 541-547

Antes de mostrar o toast de erro, fazer uma consulta rápida para buscar o nome do cliente que já possui aquele documento:

```typescript
if (error.code === "23505") {
  const docLabel = formData.possui_cnpj ? "CNPJ" : "CPF";
  const docValue = (formData.possui_cnpj ? formData.cnpj : formData.cpf)?.replace(/\D/g, "");
  
  // Buscar nome do cliente que já tem esse documento
  let nomeExistente = "";
  if (docValue) {
    const column = formData.possui_cnpj ? "cnpj" : "cpf";
    const { data: existing } = await supabase
      .from("ebd_clientes")
      .select("nome_igreja")
      .eq(column, docValue)
      .neq("id", clienteParaEditar.id)
      .maybeSingle();
    nomeExistente = existing?.nome_igreja || "";
  }
  
  const msg = nomeExistente
    ? `Este ${docLabel} já está em uso pelo cliente "${nomeExistente}". Verifique os cadastros antes de salvar.`
    : `Este ${docLabel} já está em uso por outro cliente. Verifique os cadastros antes de salvar.`;
  toast.error(msg);
  setLoading(false);
  return;
}
```

Nota: O CPF pode estar salvo com ou sem formatação. Se a busca por valor limpo não encontrar, tenta com o valor formatado como fallback. Verificarei o formato usado no banco antes de implementar.

