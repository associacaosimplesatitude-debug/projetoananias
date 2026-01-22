-- Add respostas column to store student answers
ALTER TABLE public.ebd_quiz_respostas
ADD COLUMN IF NOT EXISTS respostas JSONB;

COMMENT ON COLUMN public.ebd_quiz_respostas.respostas IS 'Respostas do aluno no formato { questao_id: "A" | "B" | "C" | "D" }';