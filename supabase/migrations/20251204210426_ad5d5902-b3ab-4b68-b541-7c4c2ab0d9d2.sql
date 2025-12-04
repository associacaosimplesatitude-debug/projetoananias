-- Remove the problematic policy that references auth.users
DROP POLICY IF EXISTS "Vendedores can view themselves" ON public.vendedores;