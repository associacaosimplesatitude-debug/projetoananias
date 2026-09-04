-- Atualiza política de gerenciamento de eventos_inscritos
DROP POLICY IF EXISTS "Admins can manage eventos_inscritos" ON public.eventos_inscritos;
CREATE POLICY "Admins can manage eventos_inscritos"
ON public.eventos_inscritos
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);

-- Atualiza política de gerenciamento de eventos_page_views
DROP POLICY IF EXISTS "Admins can manage eventos_page_views" ON public.eventos_page_views;
CREATE POLICY "Admins can manage eventos_page_views"
ON public.eventos_page_views
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'superadmin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);