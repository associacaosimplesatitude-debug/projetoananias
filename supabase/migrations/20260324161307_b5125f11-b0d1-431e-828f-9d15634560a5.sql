
-- Allow financeiro to also insert/update system_settings
DROP POLICY IF EXISTS "Admins can update system_settings" ON public.system_settings;
CREATE POLICY "Admins can update system_settings" ON public.system_settings
  FOR UPDATE TO public
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'gerente_ebd'::app_role, 'financeiro'::app_role])
  ));

DROP POLICY IF EXISTS "Admins can insert system_settings" ON public.system_settings;
CREATE POLICY "Admins can insert system_settings" ON public.system_settings
  FOR INSERT TO public
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = ANY (ARRAY['admin'::app_role, 'gerente_ebd'::app_role, 'financeiro'::app_role])
  ));
