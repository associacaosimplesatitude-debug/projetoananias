
-- ============================================================
-- Sistema de Novidades / Changelog
-- ============================================================

-- Tabela principal
CREATE TABLE public.system_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('nova_funcao', 'correcao')),
  titulo text NOT NULL,
  descricao_curta text NOT NULL,
  descricao_completa text NOT NULL,
  versao text NULL,
  data_publicacao timestamptz NOT NULL DEFAULT now(),
  ativo boolean NOT NULL DEFAULT true,
  audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all', 'roles', 'users')),
  audience_roles text[] NULL,
  audience_user_ids uuid[] NULL,
  criado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_system_news_ativo_data ON public.system_news (ativo, data_publicacao DESC);
CREATE INDEX idx_system_news_tipo ON public.system_news (tipo);

-- Anexos
CREATE TABLE public.system_news_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL REFERENCES public.system_news(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text NULL,
  tamanho_bytes bigint NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_news_attachments_news ON public.system_news_attachments (news_id);

-- Reads (marcadores de leitura)
CREATE TABLE public.system_news_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id uuid NOT NULL REFERENCES public.system_news(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (news_id, user_id)
);
CREATE INDEX idx_system_news_reads_user ON public.system_news_reads (user_id);

-- Trigger updated_at
CREATE TRIGGER trg_system_news_updated_at
BEFORE UPDATE ON public.system_news
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Função auxiliar: verifica se usuário pode ver uma news
-- ============================================================
CREATE OR REPLACE FUNCTION public.can_view_system_news(_user_id uuid, _news_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_news n
    WHERE n.id = _news_id
      AND n.ativo = true
      AND (
        n.audience_type = 'all'
        OR (
          n.audience_type = 'roles'
          AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = _user_id
              AND ur.role::text = ANY (n.audience_roles)
          )
        )
        OR (
          n.audience_type = 'users'
          AND _user_id = ANY (n.audience_user_ids)
        )
      )
  )
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.system_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_news_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_news_reads ENABLE ROW LEVEL SECURITY;

-- system_news
CREATE POLICY "news_select_visible"
ON public.system_news FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR (
    ativo = true
    AND (
      audience_type = 'all'
      OR (
        audience_type = 'roles'
        AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role::text = ANY (audience_roles)
        )
      )
      OR (audience_type = 'users' AND auth.uid() = ANY (audience_user_ids))
    )
  )
);

CREATE POLICY "news_admin_insert" ON public.system_news FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "news_admin_update" ON public.system_news FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "news_admin_delete" ON public.system_news FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- attachments
CREATE POLICY "news_attach_select"
ON public.system_news_attachments FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.can_view_system_news(auth.uid(), news_id)
);

CREATE POLICY "news_attach_admin_insert" ON public.system_news_attachments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "news_attach_admin_update" ON public.system_news_attachments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "news_attach_admin_delete" ON public.system_news_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- reads
CREATE POLICY "reads_select_own" ON public.system_news_reads FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "reads_insert_own" ON public.system_news_reads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reads_delete_own_or_admin" ON public.system_news_reads FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- View: novidades visíveis para o usuário atual com flag "lida"
-- ============================================================
CREATE OR REPLACE VIEW public.v_system_news_for_user
WITH (security_invoker = true)
AS
SELECT
  n.id,
  n.tipo,
  n.titulo,
  n.descricao_curta,
  n.descricao_completa,
  n.versao,
  n.data_publicacao,
  n.ativo,
  n.audience_type,
  n.criado_por,
  n.created_at,
  n.updated_at,
  (r.id IS NOT NULL) AS lida,
  r.lido_em
FROM public.system_news n
LEFT JOIN public.system_news_reads r
  ON r.news_id = n.id AND r.user_id = auth.uid()
WHERE n.ativo = true;

GRANT SELECT ON public.v_system_news_for_user TO authenticated;

-- ============================================================
-- Storage bucket privado + policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('system-news-attachments', 'system-news-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- SELECT: admin OU usuário com acesso à news (path: {news_id}/{arquivo})
CREATE POLICY "system_news_attach_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'system-news-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_view_system_news(
      auth.uid(),
      (split_part(name, '/', 1))::uuid
    )
  )
);

CREATE POLICY "system_news_attach_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'system-news-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "system_news_attach_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'system-news-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "system_news_attach_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'system-news-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
