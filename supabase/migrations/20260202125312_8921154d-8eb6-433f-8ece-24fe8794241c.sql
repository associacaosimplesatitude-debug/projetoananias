-- Adicionar campos do Bling na tabela de resgates
ALTER TABLE public.royalties_resgates 
ADD COLUMN IF NOT EXISTS bling_order_id TEXT,
ADD COLUMN IF NOT EXISTS bling_order_number TEXT;