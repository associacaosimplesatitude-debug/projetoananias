CREATE TABLE public.whatsapp_envio_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  tipo_mensagem TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (shopify_order_id, sku, tipo_mensagem)
);

ALTER TABLE public.whatsapp_envio_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on whatsapp_envio_locks"
ON public.whatsapp_envio_locks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);