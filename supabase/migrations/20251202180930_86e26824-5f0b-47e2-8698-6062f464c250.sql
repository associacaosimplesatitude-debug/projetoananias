-- Add avatar_url column to ebd_alunos
ALTER TABLE public.ebd_alunos 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add avatar_url column to ebd_professores
ALTER TABLE public.ebd_professores 
ADD COLUMN IF NOT EXISTS avatar_url text;