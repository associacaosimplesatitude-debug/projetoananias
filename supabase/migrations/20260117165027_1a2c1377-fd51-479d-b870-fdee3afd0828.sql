-- Add link_danfe column to vendedor_propostas
ALTER TABLE public.vendedor_propostas 
ADD COLUMN IF NOT EXISTS link_danfe TEXT;