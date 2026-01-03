ALTER TABLE public.vendedor_propostas
ADD COLUMN IF NOT EXISTS bling_order_id bigint NULL,
ADD COLUMN IF NOT EXISTS bling_order_number text NULL;

CREATE INDEX IF NOT EXISTS idx_vendedor_propostas_bling_order_id ON public.vendedor_propostas (bling_order_id);