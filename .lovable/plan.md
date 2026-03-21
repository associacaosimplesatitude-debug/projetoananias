

## Correção: Exclusão de participante não funciona para `gerente_sorteio`

### Problema
A policy de DELETE na tabela `sorteio_participantes` permite apenas a role `admin`. O usuário logado como `gerente_sorteio` recebe sucesso aparente (toast "excluído"), mas a row não é deletada no banco — o Supabase retorna 0 rows affected sem erro.

### Solução
1. **Migration SQL**: Atualizar a policy `admin_delete_participantes` para incluir `gerente_sorteio`:

```sql
DROP POLICY "admin_delete_participantes" ON public.sorteio_participantes;

CREATE POLICY "admin_gerente_delete_participantes" ON public.sorteio_participantes
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR public.has_role(auth.uid(), 'gerente_sorteio')
);
```

2. **Código (`SorteioAdmin.tsx`)**: Adicionar verificação do resultado do delete para mostrar erro caso 0 rows sejam afetadas:

```typescript
const { error, count } = await supabase
  .from("sorteio_participantes")
  .delete()
  .eq("id", id)
  .select("id", { count: "exact", head: true });
```

Nenhum outro arquivo será alterado.

