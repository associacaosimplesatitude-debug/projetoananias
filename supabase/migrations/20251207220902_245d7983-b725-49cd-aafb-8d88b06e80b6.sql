-- Add email_bling to vendedores table
ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS email_bling text;

-- Create ebd_clientes table
CREATE TABLE public.ebd_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE SET NULL,
  cnpj TEXT NOT NULL,
  nome_igreja TEXT NOT NULL,
  nome_superintendente TEXT,
  email_superintendente TEXT,
  telefone TEXT,
  dia_aula TEXT DEFAULT 'Domingo',
  data_inicio_ebd DATE,
  data_proxima_compra DATE,
  status_ativacao_ebd BOOLEAN NOT NULL DEFAULT false,
  superintendente_user_id UUID,
  ultimo_login TIMESTAMP WITH TIME ZONE,
  data_aniversario_pastor DATE,
  data_aniversario_superintendente DATE,
  bling_cliente_id BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cnpj)
);

-- Enable RLS
ALTER TABLE public.ebd_clientes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ebd_clientes
CREATE POLICY "Admins can manage all clientes"
ON public.ebd_clientes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendedores can view their own clientes"
ON public.ebd_clientes
FOR SELECT
USING (
  vendedor_id IN (
    SELECT v.id FROM public.vendedores v 
    WHERE v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Vendedores can insert clientes"
ON public.ebd_clientes
FOR INSERT
WITH CHECK (
  vendedor_id IN (
    SELECT v.id FROM public.vendedores v 
    WHERE v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Vendedores can update their own clientes"
ON public.ebd_clientes
FOR UPDATE
USING (
  vendedor_id IN (
    SELECT v.id FROM public.vendedores v 
    WHERE v.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_ebd_clientes_updated_at
BEFORE UPDATE ON public.ebd_clientes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to calculate next purchase date (based on 13-week magazine cycle)
CREATE OR REPLACE FUNCTION public.calculate_next_purchase_date(start_date DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT start_date + INTERVAL '13 weeks'
$$;