
CREATE TABLE public.revista_progresso_publico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp text NOT NULL,
  revista_id uuid REFERENCES revistas_digitais(id),
  licao_id uuid REFERENCES revista_licoes(id),
  licao_numero integer,
  licao_titulo text,
  pagina_atual integer DEFAULT 0,
  concluida boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON revista_progresso_publico(whatsapp, revista_id);

ALTER TABLE public.revista_progresso_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.revista_progresso_publico
  FOR ALL USING (true) WITH CHECK (true);
