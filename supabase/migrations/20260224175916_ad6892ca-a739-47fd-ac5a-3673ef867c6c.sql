
DROP POLICY IF EXISTS "Admins can read system_settings" ON public.system_settings;
CREATE POLICY "Authorized roles can read system_settings" ON public.system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'gerente_ebd', 'financeiro')
    )
  );
