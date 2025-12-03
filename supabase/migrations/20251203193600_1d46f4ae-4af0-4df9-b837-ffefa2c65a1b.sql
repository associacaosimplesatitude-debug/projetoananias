-- Adicionar campos do cliente do formulário na tabela ebd_pedidos
ALTER TABLE public.ebd_pedidos 
ADD COLUMN IF NOT EXISTS nome_cliente TEXT,
ADD COLUMN IF NOT EXISTS sobrenome_cliente TEXT,
ADD COLUMN IF NOT EXISTS cpf_cnpj_cliente TEXT,
ADD COLUMN IF NOT EXISTS telefone_cliente TEXT;