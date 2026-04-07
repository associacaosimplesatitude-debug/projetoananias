CREATE TABLE public.revista_ranking_publico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp text NOT NULL,
  revista_id uuid REFERENCES public.revistas_digitais(id) ON DELETE CASCADE,
  nome_comprador text,
  total_pontos integer DEFAULT 0,
  total_quizzes integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_revista_ranking_publico_whatsapp_revista ON public.revista_ranking_publico(whatsapp, revista_id);

ALTER TABLE public.revista_ranking_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on revista_ranking_publico"
  ON public.revista_ranking_publico
  FOR ALL
  USING (true)
  WITH CHECK (true);