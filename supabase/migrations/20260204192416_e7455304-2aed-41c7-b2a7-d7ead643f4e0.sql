-- Criar índice único para CPF (igual ao que existe para CNPJ)
CREATE UNIQUE INDEX IF NOT EXISTS ebd_clientes_cpf_unique_not_null 
ON public.ebd_clientes (cpf) 
WHERE (cpf IS NOT NULL);