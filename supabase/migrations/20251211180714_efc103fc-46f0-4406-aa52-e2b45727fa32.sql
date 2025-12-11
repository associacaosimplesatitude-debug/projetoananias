-- Create table for synced Shopify orders
CREATE TABLE public.ebd_shopify_pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id BIGINT NOT NULL UNIQUE,
  order_number TEXT NOT NULL,
  vendedor_id UUID REFERENCES public.vendedores(id),
  cliente_id UUID REFERENCES public.ebd_clientes(id),
  status_pagamento TEXT NOT NULL DEFAULT 'pending',
  valor_total NUMERIC NOT NULL DEFAULT 0,
  valor_frete NUMERIC NOT NULL DEFAULT 0,
  valor_para_meta NUMERIC NOT NULL DEFAULT 0,
  customer_email TEXT,
  customer_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebd_shopify_pedidos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all shopify pedidos"
ON public.ebd_shopify_pedidos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendedores can view their own shopify pedidos"
ON public.ebd_shopify_pedidos FOR SELECT
USING (vendedor_id = get_vendedor_id_by_email(get_auth_email()));

-- Create updated_at trigger
CREATE TRIGGER update_ebd_shopify_pedidos_updated_at
BEFORE UPDATE ON public.ebd_shopify_pedidos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();