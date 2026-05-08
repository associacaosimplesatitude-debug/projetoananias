
-- Componente 1: RLS UPDATE para admin/superadmin/gerente em agente_ia_mensagens
CREATE POLICY "admin_gerente_superadmin_atualizam_mensagens_agente"
ON public.agente_ia_mensagens
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
);
