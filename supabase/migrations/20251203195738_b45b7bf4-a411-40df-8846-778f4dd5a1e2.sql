-- Tabela para armazenar o último endereço de entrega do usuário
CREATE TABLE public.ebd_endereco_entrega (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  sobrenome TEXT,
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  cep TEXT NOT NULL,
  estado TEXT NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_address UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.ebd_endereco_entrega ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own address
CREATE POLICY "Users can view their own address"
ON public.ebd_endereco_entrega
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can insert their own address
CREATE POLICY "Users can insert their own address"
ON public.ebd_endereco_entrega
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own address
CREATE POLICY "Users can update their own address"
ON public.ebd_endereco_entrega
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Admins can manage all addresses
CREATE POLICY "Admins can manage all addresses"
ON public.ebd_endereco_entrega
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_ebd_endereco_entrega_updated_at
BEFORE UPDATE ON public.ebd_endereco_entrega
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();