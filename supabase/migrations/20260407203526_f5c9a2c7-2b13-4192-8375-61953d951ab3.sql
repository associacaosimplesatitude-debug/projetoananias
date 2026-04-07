
CREATE TABLE public.revista_referencias_pagina (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  licao_id uuid REFERENCES revista_licoes(id) ON DELETE CASCADE,
  pagina integer NOT NULL,
  referencias jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX ON public.revista_referencias_pagina(licao_id, pagina);

ALTER TABLE public.revista_referencias_pagina ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on revista_referencias_pagina"
  ON public.revista_referencias_pagina
  FOR ALL
  USING (true)
  WITH CHECK (true);
