-- Adicionar coluna client_type na tabela churches
ALTER TABLE public.churches 
ADD COLUMN client_type TEXT NOT NULL DEFAULT 'igreja' 
CHECK (client_type IN ('igreja', 'associacao'));

-- Atualizar todos os registros existentes para 'igreja'
UPDATE public.churches SET client_type = 'igreja';