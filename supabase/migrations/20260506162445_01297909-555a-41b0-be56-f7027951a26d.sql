CREATE POLICY "Admins can read whatsapp_conversas"
ON public.whatsapp_conversas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY (ARRAY['admin'::app_role, 'gerente_ebd'::app_role])
  )
);