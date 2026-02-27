

## Plano: Match de cliente apenas por email, CPF ou CNPJ

### Alteração

**Arquivo: `supabase/functions/ebd-shopify-order-webhook/index.ts`**

- **Remover Método 3** (linhas 336-372): Eliminar toda a busca por nome fuzzy (`.includes()`) que causa matches incorretos como o do pedido #2690
- **Manter Método 1** (email exato, linhas 291-310)
- **Manter Método 2** (CPF/CNPJ exato, linhas 312-334)

### Resultado

Pedidos Shopify serão vinculados a clientes/vendedores apenas quando houver match exato por **email** ou **CPF/CNPJ**. Sem match por nome, sem risco de vincular igrejas diferentes com nomes parecidos.

