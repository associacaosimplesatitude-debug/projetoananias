

## Plano: Mostrar nome do pedido e-commerce e data na mensagem de erro duplicado

### Problema
A mensagem atual mostra o `nome_igreja` do cliente duplicado, mas como ambos têm o mesmo nome ("Rosangela Silva"), não ajuda. O usuário quer ver **o nome que veio no pedido do e-commerce** e **a data do pedido**.

### Alteração

**Arquivo**: `src/components/vendedor/CadastrarClienteDialog.tsx` (linhas 546-560)

Após encontrar o cliente duplicado em `ebd_clientes`, buscar também o pedido Shopify vinculado a esse cliente para mostrar o nome do pedido e a data:

```typescript
if (error.code === "23505") {
  const docLabel = formData.possui_cnpj ? "CNPJ" : "CPF";
  const docValue = formData.documento?.replace(/\D/g, "");
  
  let infoExtra = "";
  if (docValue) {
    const column = formData.possui_cnpj ? "cnpj" : "cpf";
    const { data: existing } = await supabase
      .from("ebd_clientes")
      .select("id, nome_igreja, email_superintendente")
      .eq(column, docValue)
      .neq("id", clienteParaEditar.id)
      .maybeSingle();
    
    if (existing) {
      // Buscar pedido e-commerce vinculado
      const { data: pedido } = await supabase
        .from("ebd_shopify_pedidos")
        .select("customer_name, created_at, order_number")
        .eq("cliente_id", existing.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (pedido) {
        const dataPedido = new Date(pedido.created_at).toLocaleDateString("pt-BR");
        infoExtra = `Este ${docLabel} já está em uso pelo cliente "${pedido.customer_name}" (pedido #${pedido.order_number} de ${dataPedido}). Verifique os cadastros antes de salvar.`;
      } else {
        infoExtra = `Este ${docLabel} já está em uso pelo cliente "${existing.nome_igreja}" (${existing.email_superintendente || "sem email"}). Verifique os cadastros antes de salvar.`;
      }
    }
  }
  
  toast.error(infoExtra || `Este ${docLabel} já está em uso por outro cliente.`);
  setLoading(false);
  return;
}
```

A mensagem agora mostrará algo como:
> "Este CPF já está em uso pelo cliente "Rosangela Silva" (pedido #1234 de 02/03/2026). Verifique os cadastros antes de salvar."

Isso dá contexto suficiente para a vendedora identificar a origem do cadastro duplicado, mesmo que ele esteja oculto na listagem.

