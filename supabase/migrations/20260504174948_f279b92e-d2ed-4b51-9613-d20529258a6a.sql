
ALTER TABLE public.system_implementations RENAME TO implementacoes;
ALTER TABLE public.implementacoes RENAME COLUMN title TO titulo;
ALTER TABLE public.implementacoes RENAME COLUMN description TO descricao_curta;
ALTER TABLE public.implementacoes RENAME COLUMN category TO categoria;
ALTER TABLE public.implementacoes RENAME COLUMN implemented_at TO data_publicacao;

ALTER TABLE public.implementacoes
  ALTER COLUMN data_publicacao TYPE timestamptz
  USING (data_publicacao::timestamp AT TIME ZONE 'America/Sao_Paulo');

UPDATE public.implementacoes SET descricao_curta = titulo WHERE descricao_curta IS NULL;
ALTER TABLE public.implementacoes ALTER COLUMN descricao_curta SET NOT NULL;

ALTER TABLE public.implementacoes
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'nova_funcao' CHECK (tipo IN ('nova_funcao','correcao')),
  ADD COLUMN IF NOT EXISTS descricao_completa text,
  ADD COLUMN IF NOT EXISTS versao text,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS audience_type text NOT NULL DEFAULT 'all' CHECK (audience_type IN ('all','roles','users')),
  ADD COLUMN IF NOT EXISTS audience_roles text[],
  ADD COLUMN IF NOT EXISTS audience_user_ids uuid[],
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.implementacoes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_implementacoes_updated_at ON public.implementacoes;
CREATE TRIGGER trg_implementacoes_updated_at BEFORE UPDATE ON public.implementacoes
FOR EACH ROW EXECUTE FUNCTION public.implementacoes_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_implementacoes_ativo_data ON public.implementacoes (ativo, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_implementacoes_tipo ON public.implementacoes (tipo);

CREATE TABLE IF NOT EXISTS public.implementacoes_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementacao_id uuid NOT NULL REFERENCES public.implementacoes(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_impl_attach_impl ON public.implementacoes_attachments (implementacao_id);

CREATE TABLE IF NOT EXISTS public.implementacoes_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  implementacao_id uuid NOT NULL REFERENCES public.implementacoes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lido_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (implementacao_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_impl_reads_user ON public.implementacoes_reads (user_id);

DROP POLICY IF EXISTS "system_news_attach_select" ON storage.objects;
DROP POLICY IF EXISTS "system_news_attach_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "system_news_attach_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "system_news_attach_admin_delete" ON storage.objects;

DROP VIEW IF EXISTS public.v_system_news_for_user;
DROP TABLE IF EXISTS public.system_news_reads CASCADE;
DROP TABLE IF EXISTS public.system_news_attachments CASCADE;
DROP TABLE IF EXISTS public.system_news CASCADE;
DROP FUNCTION IF EXISTS public.can_view_system_news(uuid, uuid);

CREATE OR REPLACE FUNCTION public.can_view_implementacao(_user_id uuid, _impl_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.implementacoes n
    WHERE n.id = _impl_id AND n.ativo = true AND (
      n.audience_type = 'all'
      OR (n.audience_type = 'roles' AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = _user_id AND ur.role::text = ANY (n.audience_roles)
          ))
      OR (n.audience_type = 'users' AND _user_id = ANY (n.audience_user_ids))
    )
  );
$$;

ALTER TABLE public.implementacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementacoes_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementacoes_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view implementations" ON public.implementacoes;
DROP POLICY IF EXISTS "Super admins can insert implementations" ON public.implementacoes;
DROP POLICY IF EXISTS "Super admins can update implementations" ON public.implementacoes;
DROP POLICY IF EXISTS "Super admins can delete implementations" ON public.implementacoes;

CREATE POLICY "impl_select" ON public.implementacoes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (
    ativo = true AND (
      audience_type = 'all'
      OR (audience_type = 'roles' AND EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (audience_roles)
          ))
      OR (audience_type = 'users' AND auth.uid() = ANY (audience_user_ids))
    )
  )
);
CREATE POLICY "impl_admin_insert" ON public.implementacoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_admin_update" ON public.implementacoes FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_admin_delete" ON public.implementacoes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "impl_attach_select" ON public.implementacoes_attachments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.can_view_implementacao(auth.uid(), implementacao_id)
);
CREATE POLICY "impl_attach_admin_insert" ON public.implementacoes_attachments FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_attach_admin_update" ON public.implementacoes_attachments FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_attach_admin_delete" ON public.implementacoes_attachments FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "impl_reads_select_own" ON public.implementacoes_reads FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "impl_reads_insert_own" ON public.implementacoes_reads FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "impl_reads_delete_own" ON public.implementacoes_reads FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.v_implementacoes_for_user
WITH (security_invoker = true) AS
SELECT
  n.id, n.tipo, n.titulo, n.descricao_curta, n.descricao_completa,
  n.versao, n.categoria, n.data_publicacao, n.ativo, n.audience_type,
  n.criado_por, n.created_at, n.updated_at,
  (r.id IS NOT NULL) AS lida,
  r.lido_em
FROM public.implementacoes n
LEFT JOIN public.implementacoes_reads r
  ON r.implementacao_id = n.id AND r.user_id = auth.uid()
WHERE n.ativo = true
  AND (
    n.audience_type = 'all'
    OR (n.audience_type = 'roles' AND EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role::text = ANY (n.audience_roles)
        ))
    OR (n.audience_type = 'users' AND auth.uid() = ANY (n.audience_user_ids))
  );

GRANT SELECT ON public.v_implementacoes_for_user TO authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('implementacoes-attachments', 'implementacoes-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "impl_attach_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'implementacoes-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.can_view_implementacao(
      auth.uid(),
      NULLIF(split_part(name, '/', 1), '')::uuid
    )
  )
);
CREATE POLICY "impl_attach_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'implementacoes-attachments' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_attach_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'implementacoes-attachments' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "impl_attach_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'implementacoes-attachments' AND public.has_role(auth.uid(), 'admin'::public.app_role));
