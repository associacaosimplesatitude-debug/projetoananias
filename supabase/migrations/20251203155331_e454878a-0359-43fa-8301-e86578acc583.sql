-- Adicionar campos de estoque e categoria à tabela ebd_revistas
ALTER TABLE public.ebd_revistas 
ADD COLUMN IF NOT EXISTS estoque integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS categoria text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS bling_produto_id bigint DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone DEFAULT NULL;