DROP POLICY IF EXISTS "vendedores_insert_retencao" ON ebd_retencao_contatos;
DROP POLICY IF EXISTS "vendedores_select_retencao" ON ebd_retencao_contatos;
DROP POLICY IF EXISTS "admin_all_retencao" ON ebd_retencao_contatos;

CREATE POLICY "allow_insert_retencao" ON ebd_retencao_contatos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_select_retencao" ON ebd_retencao_contatos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_update_retencao" ON ebd_retencao_contatos
  FOR UPDATE USING (auth.uid() IS NOT NULL);