-- Create table for tracking individual installments of invoiced proposals
CREATE TABLE public.vendedor_propostas_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID REFERENCES public.vendedor_propostas(id) ON DELETE CASCADE,
  vendedor_id UUID REFERENCES public.vendedores(id),
  cliente_id UUID REFERENCES public.ebd_clientes(id),
  numero_parcela INT NOT NULL,
  total_parcelas INT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  valor_comissao NUMERIC(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'paga', 'atrasada')),
  origem TEXT DEFAULT 'faturado' CHECK (origem IN ('faturado', 'mercadopago')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendedor_propostas_parcelas ENABLE ROW LEVEL SECURITY;

-- Policy for vendedores to see their own parcels
CREATE POLICY "Vendedores can view their own parcelas"
ON public.vendedor_propostas_parcelas
FOR SELECT
USING (
  vendedor_id IN (
    SELECT id FROM public.vendedores WHERE email = auth.jwt()->>'email'
  )
);

-- Policy for admins to view all parcels
CREATE POLICY "Admins can view all parcelas"
ON public.vendedor_propostas_parcelas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Policy for admins to manage all parcels
CREATE POLICY "Admins can manage all parcelas"
ON public.vendedor_propostas_parcelas
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Create index for faster queries
CREATE INDEX idx_parcelas_vendedor_id ON public.vendedor_propostas_parcelas(vendedor_id);
CREATE INDEX idx_parcelas_data_vencimento ON public.vendedor_propostas_parcelas(data_vencimento);
CREATE INDEX idx_parcelas_status ON public.vendedor_propostas_parcelas(status);

-- Create trigger for updated_at
CREATE TRIGGER update_vendedor_propostas_parcelas_updated_at
BEFORE UPDATE ON public.vendedor_propostas_parcelas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();