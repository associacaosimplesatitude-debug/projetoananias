-- Create plano_de_contas table for accounting module
CREATE TABLE public.plano_de_contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_conta TEXT NOT NULL,
  nome_conta TEXT NOT NULL,
  tipo_conta TEXT NOT NULL CHECK (tipo_conta IN ('Sintética', 'Analítica')),
  natureza TEXT NOT NULL CHECK (natureza IN ('Devedora', 'Credora')),
  grupo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.plano_de_contas ENABLE ROW LEVEL SECURITY;

-- Create policies for plano_de_contas
CREATE POLICY "Admins can manage plano de contas"
ON public.plano_de_contas
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view plano de contas"
ON public.plano_de_contas
FOR SELECT
USING (true);

-- Create index for faster lookups by codigo_conta
CREATE INDEX idx_plano_de_contas_codigo ON public.plano_de_contas(codigo_conta);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_plano_de_contas_updated_at
BEFORE UPDATE ON public.plano_de_contas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();