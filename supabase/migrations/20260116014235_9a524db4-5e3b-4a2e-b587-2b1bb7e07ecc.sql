-- Adicionar coluna vendedor_email na tabela vendedor_propostas
ALTER TABLE public.vendedor_propostas 
ADD COLUMN IF NOT EXISTS vendedor_email TEXT;

-- Backfill: Atualizar propostas existentes com o email do vendedor
UPDATE public.vendedor_propostas vp
SET vendedor_email = v.email
FROM vendedores v
WHERE vp.vendedor_id = v.id
AND vp.vendedor_email IS NULL;