
-- 1. Tabela de planos de licença
CREATE TABLE public.revista_planos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  quantidade_licencas int NOT NULL,
  preco_trimestral numeric NOT NULL DEFAULT 0,
  preco_semestral numeric NOT NULL DEFAULT 0,
  preco_anual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Tabela de licenças compradas
CREATE TABLE public.revista_licencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  superintendente_id uuid NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  revista_id uuid REFERENCES public.revistas_digitais(id) ON DELETE SET NULL,
  plano text NOT NULL DEFAULT 'trimestral',
  quantidade_total int NOT NULL DEFAULT 0,
  quantidade_usada int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativa',
  inicio_em date NOT NULL DEFAULT CURRENT_DATE,
  expira_em date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Tabela de alunos vinculados a licenças
CREATE TABLE public.revista_licenca_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licenca_id uuid NOT NULL REFERENCES public.revista_licencas(id) ON DELETE CASCADE,
  superintendente_id uuid NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  aluno_nome text NOT NULL,
  aluno_telefone text,
  aluno_email text,
  aluno_turma text,
  status text NOT NULL DEFAULT 'pendente',
  comprovante_url text,
  comprovante_enviado_em timestamptz,
  aprovado_em timestamptz,
  aprovado_por uuid REFERENCES public.ebd_clientes(id),
  device_token text,
  device_info jsonb,
  device_autorizado_em timestamptz,
  troca_dispositivo_solicitada boolean NOT NULL DEFAULT false,
  troca_solicitada_em timestamptz,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Log de acessos bloqueados
CREATE TABLE public.revista_acessos_bloqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.revista_licenca_alunos(id) ON DELETE CASCADE,
  device_token_tentativa text,
  device_info_tentativa jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.revista_planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_licencas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_licenca_alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_acessos_bloqueados ENABLE ROW LEVEL SECURITY;

-- revista_planos: admin full, todos authenticated podem ler ativos
CREATE POLICY "Admin full access on revista_planos" ON public.revista_planos
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "Authenticated can read active plans" ON public.revista_planos
  FOR SELECT TO authenticated
  USING (ativo = true);

-- revista_licencas: admin full, SE vê apenas suas
CREATE POLICY "Admin full access on revista_licencas" ON public.revista_licencas
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "SE can view own licencas" ON public.revista_licencas
  FOR SELECT TO authenticated
  USING (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  );

CREATE POLICY "SE can update own licencas" ON public.revista_licencas
  FOR UPDATE TO authenticated
  USING (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  )
  WITH CHECK (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  );

-- revista_licenca_alunos: admin full, SE vê/gerencia seus alunos, aluno vê seu registro
CREATE POLICY "Admin full access on revista_licenca_alunos" ON public.revista_licenca_alunos
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "SE can manage own alunos" ON public.revista_licenca_alunos
  FOR ALL TO authenticated
  USING (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  )
  WITH CHECK (
    superintendente_id IN (
      SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  );

CREATE POLICY "Aluno can view own record" ON public.revista_licenca_alunos
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Aluno can update own record" ON public.revista_licenca_alunos
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- revista_acessos_bloqueados: admin full, SE pode ver de seus alunos
CREATE POLICY "Admin full access on revista_acessos_bloqueados" ON public.revista_acessos_bloqueados
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "SE can view own blocked access" ON public.revista_acessos_bloqueados
  FOR SELECT TO authenticated
  USING (
    aluno_id IN (
      SELECT rla.id FROM public.revista_licenca_alunos rla
      WHERE rla.superintendente_id IN (
        SELECT id FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
      )
    )
  );

-- Storage bucket for comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes', 'comprovantes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated can upload comprovantes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes');

CREATE POLICY "Admin can view all comprovantes" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes' AND public.is_admin_geral(auth.uid()));

CREATE POLICY "SE can view own comprovantes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes' AND
    EXISTS (
      SELECT 1 FROM public.ebd_clientes WHERE superintendente_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own comprovantes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovantes' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
