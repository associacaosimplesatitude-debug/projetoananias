-- Adicionar campo pode_faturar na tabela ebd_clientes
ALTER TABLE public.ebd_clientes
ADD COLUMN pode_faturar boolean DEFAULT false NOT NULL;