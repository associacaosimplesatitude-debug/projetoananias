
CREATE TABLE public.revista_quiz_respostas_publico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id uuid REFERENCES public.revista_licao_quiz(id) ON DELETE CASCADE,
  licao_id uuid REFERENCES public.revista_licoes(id) ON DELETE CASCADE,
  whatsapp text NOT NULL,
  respostas jsonb NOT NULL DEFAULT '{}',
  acertos integer DEFAULT 0,
  total_perguntas integer DEFAULT 0,
  pontos_ganhos integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON public.revista_quiz_respostas_publico(quiz_id, whatsapp);

ALTER TABLE public.revista_quiz_respostas_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.revista_quiz_respostas_publico
  FOR ALL USING (true) WITH CHECK (true);
