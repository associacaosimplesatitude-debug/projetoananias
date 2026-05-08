DROP POLICY IF EXISTS "admin_gerente_leem_conversas_agente" ON public.agente_ia_conversas;
CREATE POLICY "admin_gerente_superadmin_leem_conversas_agente"
  ON public.agente_ia_conversas FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );

DROP POLICY IF EXISTS "admin_gerente_leem_mensagens_agente" ON public.agente_ia_mensagens;
CREATE POLICY "admin_gerente_superadmin_leem_mensagens_agente"
  ON public.agente_ia_mensagens FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );

DROP POLICY IF EXISTS "admin_gerente_veem_todas_escalations" ON public.agente_ia_escalations;
CREATE POLICY "admin_gerente_superadmin_veem_escalations"
  ON public.agente_ia_escalations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.has_role(auth.uid(), 'superadmin'::public.app_role)
  );