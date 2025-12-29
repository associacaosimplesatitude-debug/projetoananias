ALTER TABLE public.vendedor_propostas
ADD COLUMN IF NOT EXISTS payment_link TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_vendedor_propostas_payment_link
ON public.vendedor_propostas (payment_link);
