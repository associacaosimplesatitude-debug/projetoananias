-- Create table for class session data (ofertas, visitantes, etc.)
CREATE TABLE public.ebd_dados_aula (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  data date NOT NULL,
  valor_ofertas numeric DEFAULT 0,
  num_visitantes integer DEFAULT 0,
  num_biblias integer DEFAULT 0,
  num_revistas integer DEFAULT 0,
  observacao text,
  registrado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(turma_id, data)
);

-- Enable RLS
ALTER TABLE public.ebd_dados_aula ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all dados_aula"
ON public.ebd_dados_aula FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their dados_aula"
ON public.ebd_dados_aula FOR ALL
USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Add comments
COMMENT ON TABLE public.ebd_dados_aula IS 'Registros de dados das aulas da EBD (ofertas, visitantes, bíblias, revistas)';
COMMENT ON COLUMN public.ebd_dados_aula.valor_ofertas IS 'Valor total das ofertas coletadas na aula';
COMMENT ON COLUMN public.ebd_dados_aula.num_visitantes IS 'Número de visitantes na aula';
COMMENT ON COLUMN public.ebd_dados_aula.num_biblias IS 'Número de bíblias trazidas pelos alunos';
COMMENT ON COLUMN public.ebd_dados_aula.num_revistas IS 'Número de revistas trazidas pelos alunos';