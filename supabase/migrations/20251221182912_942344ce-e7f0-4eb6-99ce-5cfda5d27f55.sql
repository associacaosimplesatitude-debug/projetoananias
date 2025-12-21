-- Create table for Central Gospel Shopify orders
CREATE TABLE public.ebd_shopify_pedidos_cg (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shopify_order_id bigint NOT NULL UNIQUE,
  order_number text NOT NULL,
  status_pagamento text NOT NULL DEFAULT 'pending',
  customer_email text,
  customer_name text,
  valor_total numeric NOT NULL DEFAULT 0,
  valor_frete numeric NOT NULL DEFAULT 0,
  codigo_rastreio text,
  url_rastreio text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebd_shopify_pedidos_cg ENABLE ROW LEVEL SECURITY;

-- Only admins and gerente_ebd can manage these orders
CREATE POLICY "Admins can manage all cg pedidos" 
ON public.ebd_shopify_pedidos_cg 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerente EBD can select cg pedidos" 
ON public.ebd_shopify_pedidos_cg 
FOR SELECT 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can update cg pedidos" 
ON public.ebd_shopify_pedidos_cg 
FOR UPDATE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can delete cg pedidos" 
ON public.ebd_shopify_pedidos_cg 
FOR DELETE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));