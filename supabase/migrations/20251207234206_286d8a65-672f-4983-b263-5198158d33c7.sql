-- Drop the problematic policies on ebd_clientes
DROP POLICY IF EXISTS "Vendedores can insert clientes" ON public.ebd_clientes;
DROP POLICY IF EXISTS "Vendedores can update their own clientes" ON public.ebd_clientes;
DROP POLICY IF EXISTS "Vendedores can view their own clientes" ON public.ebd_clientes;

-- Create helper function to get vendedor_id by email safely
CREATE OR REPLACE FUNCTION public.get_vendedor_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.vendedores WHERE email = _email LIMIT 1
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Vendedores can view their own clientes" 
ON public.ebd_clientes 
FOR SELECT 
USING (vendedor_id = public.get_vendedor_id_by_email(public.get_auth_email()));

CREATE POLICY "Vendedores can insert clientes" 
ON public.ebd_clientes 
FOR INSERT 
WITH CHECK (vendedor_id = public.get_vendedor_id_by_email(public.get_auth_email()));

CREATE POLICY "Vendedores can update their own clientes" 
ON public.ebd_clientes 
FOR UPDATE 
USING (vendedor_id = public.get_vendedor_id_by_email(public.get_auth_email()));