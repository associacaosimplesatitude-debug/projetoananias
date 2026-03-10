
-- Revistas digitais
CREATE TABLE public.revistas_digitais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'aluno',
  trimestre text,
  capa_url text,
  total_licoes int DEFAULT 13,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Lições de cada revista
CREATE TABLE public.revista_licoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revista_id uuid REFERENCES public.revistas_digitais(id) ON DELETE CASCADE NOT NULL,
  numero int NOT NULL,
  titulo text,
  paginas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Assinaturas
CREATE TABLE public.revista_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.ebd_clientes(id) ON DELETE CASCADE NOT NULL,
  revista_id uuid REFERENCES public.revistas_digitais(id) ON DELETE CASCADE NOT NULL,
  plano text DEFAULT 'trimestral',
  status text DEFAULT 'ativa',
  inicio_em date,
  expira_em date,
  created_at timestamptz DEFAULT now()
);

-- Progresso de leitura
CREATE TABLE public.revista_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.ebd_clientes(id) ON DELETE CASCADE NOT NULL,
  licao_id uuid REFERENCES public.revista_licoes(id) ON DELETE CASCADE NOT NULL,
  pagina_atual int DEFAULT 1,
  concluida boolean DEFAULT false,
  tempo_leitura_segundos int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(cliente_id, licao_id)
);

-- Acessos
CREATE TABLE public.revista_acessos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid REFERENCES public.ebd_clientes(id) ON DELETE CASCADE NOT NULL,
  revista_id uuid REFERENCES public.revistas_digitais(id) ON DELETE CASCADE,
  licao_id uuid REFERENCES public.revista_licoes(id) ON DELETE CASCADE,
  evento text NOT NULL,
  device_info jsonb,
  created_at timestamptz DEFAULT now()
);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('revistas', 'revistas', true);

-- RLS
ALTER TABLE public.revistas_digitais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_licoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_progresso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_acessos ENABLE ROW LEVEL SECURITY;

-- Read policies (authenticated users can read active revistas)
CREATE POLICY "Anyone can read active revistas" ON public.revistas_digitais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can read licoes" ON public.revista_licoes FOR SELECT TO authenticated USING (true);

-- Assinaturas: users see own, admins see all
CREATE POLICY "Users read own assinaturas" ON public.revista_assinaturas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage assinaturas" ON public.revista_assinaturas FOR ALL TO authenticated USING (public.is_admin_geral(auth.uid()));

-- Progresso: users manage own
CREATE POLICY "Users read own progresso" ON public.revista_progresso FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users upsert own progresso" ON public.revista_progresso FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users update own progresso" ON public.revista_progresso FOR UPDATE TO authenticated USING (true);

-- Acessos: users insert own
CREATE POLICY "Users insert acessos" ON public.revista_acessos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins read acessos" ON public.revista_acessos FOR SELECT TO authenticated USING (public.is_admin_geral(auth.uid()));

-- Admin policies for revistas/licoes
CREATE POLICY "Admins manage revistas" ON public.revistas_digitais FOR ALL TO authenticated USING (public.is_admin_geral(auth.uid()));
CREATE POLICY "Admins manage licoes" ON public.revista_licoes FOR ALL TO authenticated USING (public.is_admin_geral(auth.uid()));

-- Storage policies
CREATE POLICY "Anyone can read revistas files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'revistas');
CREATE POLICY "Admins can upload revistas files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'revistas' AND public.is_admin_geral(auth.uid()));
CREATE POLICY "Admins can delete revistas files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'revistas' AND public.is_admin_geral(auth.uid()));
