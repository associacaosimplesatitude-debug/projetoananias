-- Fix ebd_clientes uniqueness so CPF clients don't collide on empty-string CNPJ

-- 1) Drop the old UNIQUE constraint on cnpj
ALTER TABLE public.ebd_clientes DROP CONSTRAINT IF EXISTS ebd_clientes_cnpj_key;

-- 2) Allow cnpj to be nullable
ALTER TABLE public.ebd_clientes ALTER COLUMN cnpj DROP NOT NULL;

-- 3) Normalize existing CPF records that used empty-string CNPJ
UPDATE public.ebd_clientes SET cnpj = NULL WHERE cnpj = '';

-- 4) Recreate uniqueness properly (only when values are present)
CREATE UNIQUE INDEX IF NOT EXISTS ebd_clientes_cnpj_unique_not_null
  ON public.ebd_clientes (cnpj)
  WHERE cnpj IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ebd_clientes_cpf_unique_not_null
  ON public.ebd_clientes (cpf)
  WHERE cpf IS NOT NULL;