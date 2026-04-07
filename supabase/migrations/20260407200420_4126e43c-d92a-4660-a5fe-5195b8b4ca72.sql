
CREATE TABLE public.revista_anotacoes_publico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  whatsapp text NOT NULL,
  revista_id uuid REFERENCES revistas_digitais(id) ON DELETE CASCADE,
  licao_id uuid REFERENCES revista_licoes(id) ON DELETE CASCADE,
  pagina integer NOT NULL,
  texto text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON revista_anotacoes_publico(whatsapp, licao_id, pagina);

ALTER TABLE public.revista_anotacoes_publico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON public.revista_anotacoes_publico
  FOR ALL USING (true) WITH CHECK (true);
