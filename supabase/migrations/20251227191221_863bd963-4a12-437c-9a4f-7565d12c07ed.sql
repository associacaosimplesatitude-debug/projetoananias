-- Drop the problematic unique constraint that doesn't allow multiple NULL CPFs
DROP INDEX IF EXISTS public.ebd_clientes_cpf_unique_not_null;