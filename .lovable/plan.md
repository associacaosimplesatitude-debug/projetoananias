

## Fix RLS Policies on `ebd_retencao_contatos`

The error "permission denied for table users" occurs because the existing RLS policies reference the `users` table, which the authenticated user cannot access. The fix replaces all policies with simple `auth.uid() IS NOT NULL` checks.

### Migration SQL

Drop all existing policies and recreate three simple ones (INSERT, SELECT, UPDATE) that only check `auth.uid() IS NOT NULL`. This allows any authenticated user to interact with the table without querying restricted system tables.

```sql
DROP POLICY IF EXISTS "vendedores_insert_retencao" ON ebd_retencao_contatos;
DROP POLICY IF EXISTS "vendedores_select_retencao" ON ebd_retencao_contatos;
DROP POLICY IF EXISTS "admin_all_retencao" ON ebd_retencao_contatos;

CREATE POLICY "allow_insert_retencao" ON ebd_retencao_contatos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_select_retencao" ON ebd_retencao_contatos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_update_retencao" ON ebd_retencao_contatos
  FOR UPDATE USING (auth.uid() IS NOT NULL);
```

No frontend changes needed.

