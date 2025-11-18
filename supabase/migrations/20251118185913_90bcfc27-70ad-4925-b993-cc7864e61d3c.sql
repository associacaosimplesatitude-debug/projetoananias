-- Add CNPJ field to churches table
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS cnpj TEXT;