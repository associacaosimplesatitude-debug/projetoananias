-- =============================================
-- FASE 1A - PARTE 2: Funções Helper e Políticas RLS
-- =============================================

-- 1. Função helper para verificar acesso admin ao módulo royalties
CREATE OR REPLACE FUNCTION public.has_royalties_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gerente_royalties')
  )
$$;

-- 2. Função helper para verificar se é autor
CREATE OR REPLACE FUNCTION public.is_royalties_autor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.royalties_autores
    WHERE user_id = _user_id
      AND is_active = true
  )
$$;

-- 3. Função helper para obter autor_id pelo user_id
CREATE OR REPLACE FUNCTION public.get_autor_id_by_user(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.royalties_autores
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$$;

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_AUTORES
-- =============================================
CREATE POLICY "Admins podem ver todos autores"
  ON public.royalties_autores FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver próprio registro"
  ON public.royalties_autores FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem inserir autores"
  ON public.royalties_autores FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar autores"
  ON public.royalties_autores FOR UPDATE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode atualizar próprio registro"
  ON public.royalties_autores FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins podem deletar autores"
  ON public.royalties_autores FOR DELETE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_LIVROS
-- =============================================
CREATE POLICY "Admins podem ver todos livros"
  ON public.royalties_livros FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver próprios livros"
  ON public.royalties_livros FOR SELECT
  TO authenticated
  USING (autor_id = public.get_autor_id_by_user(auth.uid()));

CREATE POLICY "Admins podem inserir livros"
  ON public.royalties_livros FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar livros"
  ON public.royalties_livros FOR UPDATE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar livros"
  ON public.royalties_livros FOR DELETE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_COMISSOES
-- =============================================
CREATE POLICY "Admins podem ver todas comissões"
  ON public.royalties_comissoes FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver comissões dos próprios livros"
  ON public.royalties_comissoes FOR SELECT
  TO authenticated
  USING (
    livro_id IN (
      SELECT id FROM public.royalties_livros 
      WHERE autor_id = public.get_autor_id_by_user(auth.uid())
    )
  );

CREATE POLICY "Admins podem inserir comissões"
  ON public.royalties_comissoes FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar comissões"
  ON public.royalties_comissoes FOR UPDATE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar comissões"
  ON public.royalties_comissoes FOR DELETE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_VENDAS
-- =============================================
CREATE POLICY "Admins podem ver todas vendas"
  ON public.royalties_vendas FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver vendas dos próprios livros"
  ON public.royalties_vendas FOR SELECT
  TO authenticated
  USING (
    livro_id IN (
      SELECT id FROM public.royalties_livros 
      WHERE autor_id = public.get_autor_id_by_user(auth.uid())
    )
  );

CREATE POLICY "Admins podem inserir vendas"
  ON public.royalties_vendas FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar vendas"
  ON public.royalties_vendas FOR UPDATE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar vendas"
  ON public.royalties_vendas FOR DELETE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_PAGAMENTOS
-- =============================================
CREATE POLICY "Admins podem ver todos pagamentos"
  ON public.royalties_pagamentos FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver próprios pagamentos"
  ON public.royalties_pagamentos FOR SELECT
  TO authenticated
  USING (autor_id = public.get_autor_id_by_user(auth.uid()));

CREATE POLICY "Admins podem inserir pagamentos"
  ON public.royalties_pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar pagamentos"
  ON public.royalties_pagamentos FOR UPDATE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar pagamentos"
  ON public.royalties_pagamentos FOR DELETE
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS RLS - ROYALTIES_AUDIT_LOGS
-- =============================================
CREATE POLICY "Admins podem ver logs de auditoria"
  ON public.royalties_audit_logs FOR SELECT
  TO authenticated
  USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Sistema pode inserir logs"
  ON public.royalties_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS DE STORAGE - ROYALTIES-CAPAS (público para leitura)
-- =============================================
CREATE POLICY "Capas são públicas para leitura"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'royalties-capas');

CREATE POLICY "Admins podem upload de capas"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'royalties-capas' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar capas"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'royalties-capas' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar capas"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'royalties-capas' AND public.has_royalties_access(auth.uid()));

-- =============================================
-- POLÍTICAS DE STORAGE - ROYALTIES-COMPROVANTES (privado)
-- =============================================
CREATE POLICY "Admins podem ver comprovantes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'royalties-comprovantes' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Autor pode ver próprios comprovantes"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'royalties-comprovantes' 
    AND (storage.foldername(name))[1] = public.get_autor_id_by_user(auth.uid())::text
  );

CREATE POLICY "Admins podem upload de comprovantes"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'royalties-comprovantes' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem atualizar comprovantes"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'royalties-comprovantes' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins podem deletar comprovantes"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'royalties-comprovantes' AND public.has_royalties_access(auth.uid()));