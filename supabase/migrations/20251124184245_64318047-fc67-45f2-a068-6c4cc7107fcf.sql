-- Criar tabela de relacionamento N:N entre professores e turmas
CREATE TABLE IF NOT EXISTS public.ebd_professores_turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id uuid NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  professor_id uuid NOT NULL REFERENCES public.ebd_professores(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(turma_id, professor_id)
);

-- Enable RLS
ALTER TABLE public.ebd_professores_turmas ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all professores_turmas"
ON public.ebd_professores_turmas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their professores_turmas"
ON public.ebd_professores_turmas
FOR ALL
TO authenticated
USING (
  turma_id IN (
    SELECT id FROM public.ebd_turmas 
    WHERE church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  turma_id IN (
    SELECT id FROM public.ebd_turmas 
    WHERE church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  )
);

-- Criar índices para melhor performance
CREATE INDEX idx_professores_turmas_turma_id ON public.ebd_professores_turmas(turma_id);
CREATE INDEX idx_professores_turmas_professor_id ON public.ebd_professores_turmas(professor_id);