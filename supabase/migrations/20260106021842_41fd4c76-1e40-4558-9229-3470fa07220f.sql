ALTER TABLE public.ebd_clientes
ADD COLUMN IF NOT EXISTS is_pos_venda_ecommerce boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ebd_clientes_posvenda
ON public.ebd_clientes (vendedor_id, is_pos_venda_ecommerce, status_ativacao_ebd);