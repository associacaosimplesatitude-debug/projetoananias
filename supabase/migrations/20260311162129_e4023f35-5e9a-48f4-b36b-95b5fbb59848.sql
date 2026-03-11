
-- Quiz tables for revista virtual
CREATE TABLE public.revista_licao_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  licao_id uuid REFERENCES public.revista_licoes(id) ON DELETE CASCADE NOT NULL,
  perguntas jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(licao_id)
);

CREATE TABLE public.revista_licao_quiz_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.revista_licao_quiz(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  respostas jsonb NOT NULL DEFAULT '{}',
  acertos int DEFAULT 0,
  pontos_ganhos int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(quiz_id, user_id)
);

ALTER TABLE public.revista_licao_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revista_licao_quiz_respostas ENABLE ROW LEVEL SECURITY;

-- Quiz: anyone authenticated can read
CREATE POLICY "Authenticated can read quiz"
  ON public.revista_licao_quiz FOR SELECT TO authenticated USING (true);

-- Quiz: admins can manage
CREATE POLICY "Admins manage quiz"
  ON public.revista_licao_quiz FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

-- Respostas: users can read own
CREATE POLICY "Users read own respostas"
  ON public.revista_licao_quiz_respostas FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Respostas: users can insert own
CREATE POLICY "Users insert own respostas"
  ON public.revista_licao_quiz_respostas FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role / admin can do everything on respostas
CREATE POLICY "Admins manage respostas"
  ON public.revista_licao_quiz_respostas FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));
