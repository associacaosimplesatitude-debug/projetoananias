-- Create vendedores table
CREATE TABLE public.vendedores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  foto_url TEXT,
  comissao_percentual NUMERIC NOT NULL DEFAULT 5.00,
  status TEXT NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  meta_mensal_valor NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add vendedor_id to churches table
ALTER TABLE public.churches ADD COLUMN vendedor_id UUID REFERENCES public.vendedores(id);

-- Enable RLS
ALTER TABLE public.vendedores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendedores
CREATE POLICY "Admins can manage all vendedores"
ON public.vendedores
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Vendedores can view themselves"
ON public.vendedores
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_vendedores_updated_at
BEFORE UPDATE ON public.vendedores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();