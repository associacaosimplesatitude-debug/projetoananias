-- Adicionar coluna para segundo professor na escala
ALTER TABLE public.ebd_escalas 
ADD COLUMN IF NOT EXISTS professor_id_2 UUID REFERENCES public.ebd_professores(id);

-- Comentário explicativo
COMMENT ON COLUMN public.ebd_escalas.professor_id_2 IS 'ID do segundo professor opcional para a aula';