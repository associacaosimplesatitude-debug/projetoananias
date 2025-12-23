-- Create table for Bling marketplace orders (Amazon, Shopee, Mercado Livre)
CREATE TABLE public.bling_marketplace_pedidos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bling_order_id BIGINT NOT NULL UNIQUE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('AMAZON', 'SHOPEE', 'MERCADO_LIVRE')),
  order_number TEXT NOT NULL,
  order_date TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  customer_email TEXT,
  customer_document TEXT,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  valor_frete NUMERIC NOT NULL DEFAULT 0,
  status_pagamento TEXT NOT NULL DEFAULT 'pending',
  status_logistico TEXT,
  codigo_rastreio TEXT,
  url_rastreio TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_bling_marketplace_pedidos_marketplace ON public.bling_marketplace_pedidos(marketplace);
CREATE INDEX idx_bling_marketplace_pedidos_order_date ON public.bling_marketplace_pedidos(order_date);
CREATE INDEX idx_bling_marketplace_pedidos_status ON public.bling_marketplace_pedidos(status_pagamento);

-- Enable Row Level Security
ALTER TABLE public.bling_marketplace_pedidos ENABLE ROW LEVEL SECURITY;

-- Admin can manage all marketplace orders
CREATE POLICY "Admins can manage all marketplace pedidos" 
ON public.bling_marketplace_pedidos 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Gerente EBD can view/update/delete marketplace orders
CREATE POLICY "Gerente EBD can select marketplace pedidos" 
ON public.bling_marketplace_pedidos 
FOR SELECT 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can update marketplace pedidos" 
ON public.bling_marketplace_pedidos 
FOR UPDATE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can delete marketplace pedidos" 
ON public.bling_marketplace_pedidos 
FOR DELETE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));