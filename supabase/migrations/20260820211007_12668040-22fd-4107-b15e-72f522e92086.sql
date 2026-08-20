CREATE TABLE public.eventos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  ativo boolean not null default true,
  descricao text,
  banner_url text,
  cor_primaria text default '#1d4ed8',
  texto_botao_cta text default 'Quero me inscrever',
  data_inicio timestamptz,
  data_fim timestamptz,
  campos_extra jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos TO authenticated;
GRANT ALL ON public.eventos TO service_role;
GRANT SELECT ON public.eventos TO anon;

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage eventos"
  ON public.eventos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Public can view active eventos"
  ON public.eventos FOR SELECT
  TO anon
  USING (ativo = true);

CREATE INDEX idx_eventos_slug ON public.eventos (slug);

CREATE TABLE public.eventos_inscritos (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  nome text not null,
  whatsapp text,
  email text,
  cidade text,
  respostas_extra jsonb not null default '{}'::jsonb,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_inscritos TO authenticated;
GRANT ALL ON public.eventos_inscritos TO service_role;
GRANT INSERT ON public.eventos_inscritos TO anon;

ALTER TABLE public.eventos_inscritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage eventos_inscritos"
  ON public.eventos_inscritos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Public can submit inscricoes"
  ON public.eventos_inscritos FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE INDEX idx_eventos_inscritos_evento_id ON public.eventos_inscritos (evento_id);

CREATE TABLE public.eventos_page_views (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  sessao_id text,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.eventos_page_views TO authenticated;
GRANT ALL ON public.eventos_page_views TO service_role;
GRANT INSERT ON public.eventos_page_views TO anon;

ALTER TABLE public.eventos_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage eventos_page_views"
  ON public.eventos_page_views FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Public can register page views"
  ON public.eventos_page_views FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_eventos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_eventos_updated_at
  BEFORE UPDATE ON public.eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_eventos_updated_at();