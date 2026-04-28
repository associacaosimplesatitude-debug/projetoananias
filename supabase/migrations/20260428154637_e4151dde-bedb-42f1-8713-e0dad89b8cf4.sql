-- Idempotência e origem em revista_licencas
ALTER TABLE public.revista_licencas
  ADD COLUMN IF NOT EXISTS loja_order_id uuid,
  ADD COLUMN IF NOT EXISTS origem text;

CREATE UNIQUE INDEX IF NOT EXISTS revista_licencas_loja_order_id_idx
  ON public.revista_licencas (loja_order_id)
  WHERE loja_order_id IS NOT NULL;

-- Status de provisionamento em ebd_loja_pedidos_cg
ALTER TABLE public.ebd_loja_pedidos_cg
  ADD COLUMN IF NOT EXISTS provisionamento_status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS provisionamento_erro text;

-- Pedidos antigos (sem flag SE) ficam marcados como nao_aplicavel
UPDATE public.ebd_loja_pedidos_cg
SET provisionamento_status = 'nao_aplicavel'
WHERE provisionamento_status IS NULL OR provisionamento_status = 'pendente';