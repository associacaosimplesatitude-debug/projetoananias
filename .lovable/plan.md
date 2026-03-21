

## Correção: RLS da tabela sorteio_page_views

### Problema
A política de SELECT na tabela `sorteio_page_views` permite apenas `admin`, mas o usuário logado tem role `gerente_sorteio`. Por isso aparece 0 acessos.

### Solução
Atualizar a RLS policy para incluir `gerente_sorteio`:

```sql
DROP POLICY "Admins can view page views" ON public.sorteio_page_views;

CREATE POLICY "Admins and gerente_sorteio can view page views"
  ON public.sorteio_page_views FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'gerente_sorteio')
  );
```

**Arquivo alterado:** apenas migration SQL, nenhuma alteração de código.

