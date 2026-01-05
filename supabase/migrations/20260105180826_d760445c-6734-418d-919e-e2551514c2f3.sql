-- Adicionar campos para rastrear quem atribuiu o desconto
ALTER TABLE public.ebd_clientes
ADD COLUMN desconto_atribuido_por UUID REFERENCES auth.users(id),
ADD COLUMN desconto_atribuido_em TIMESTAMP WITH TIME ZONE;

-- Comentários para documentação
COMMENT ON COLUMN public.ebd_clientes.desconto_atribuido_por IS 'ID do usuário que atribuiu o desconto ao cliente';
COMMENT ON COLUMN public.ebd_clientes.desconto_atribuido_em IS 'Data/hora em que o desconto foi atribuído';