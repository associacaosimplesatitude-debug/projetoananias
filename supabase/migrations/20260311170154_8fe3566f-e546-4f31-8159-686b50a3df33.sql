
-- 1. Create helper function
CREATE OR REPLACE FUNCTION public.can_manage_revistas(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gerente_ebd')
  )
$$;

-- 2. Storage policies
DROP POLICY "Admins can upload revistas files" ON storage.objects;
CREATE POLICY "Managers can upload revistas files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()));

DROP POLICY "Admins can delete revistas files" ON storage.objects;
CREATE POLICY "Managers can delete revistas files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'revistas' AND public.can_manage_revistas(auth.uid()));

-- 3. revistas_digitais
DROP POLICY "Admins manage revistas" ON public.revistas_digitais;
CREATE POLICY "Managers manage revistas" ON public.revistas_digitais
  FOR ALL TO authenticated
  USING (public.can_manage_revistas(auth.uid()))
  WITH CHECK (public.can_manage_revistas(auth.uid()));

-- 4. revista_licoes
DROP POLICY "Admins manage licoes" ON public.revista_licoes;
CREATE POLICY "Managers manage licoes" ON public.revista_licoes
  FOR ALL TO authenticated
  USING (public.can_manage_revistas(auth.uid()))
  WITH CHECK (public.can_manage_revistas(auth.uid()));

-- 5. revista_licao_quiz
DROP POLICY "Admins manage quiz" ON public.revista_licao_quiz;
CREATE POLICY "Managers manage quiz" ON public.revista_licao_quiz
  FOR ALL TO authenticated
  USING (public.can_manage_revistas(auth.uid()))
  WITH CHECK (public.can_manage_revistas(auth.uid()));
