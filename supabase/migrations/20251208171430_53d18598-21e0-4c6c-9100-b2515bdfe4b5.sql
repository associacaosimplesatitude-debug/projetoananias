-- Add new columns to ebd_clientes for complete client data
ALTER TABLE public.ebd_clientes 
ADD COLUMN IF NOT EXISTS tipo_cliente text DEFAULT 'Igreja',
ADD COLUMN IF NOT EXISTS nome_responsavel text,
ADD COLUMN IF NOT EXISTS senha_temporaria text,
ADD COLUMN IF NOT EXISTS possui_cnpj boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS rg text,
ADD COLUMN IF NOT EXISTS cpf text,
ADD COLUMN IF NOT EXISTS endereco_cep text,
ADD COLUMN IF NOT EXISTS endereco_rua text,
ADD COLUMN IF NOT EXISTS endereco_numero text,
ADD COLUMN IF NOT EXISTS endereco_complemento text,
ADD COLUMN IF NOT EXISTS endereco_bairro text,
ADD COLUMN IF NOT EXISTS endereco_cidade text,
ADD COLUMN IF NOT EXISTS endereco_estado text;