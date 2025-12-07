-- Drop the problematic policy
DROP POLICY IF EXISTS "Vendedores can view their own record" ON public.vendedores;

-- Create a security definer function to check if user is vendedor
CREATE OR REPLACE FUNCTION public.is_vendedor(_user_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vendedores
    WHERE email = _user_email
  )
$$;

-- Create a security definer function to get user email safely
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Create new policy using the security definer function
CREATE POLICY "Vendedores can view their own record" 
ON public.vendedores 
FOR SELECT 
USING (email = public.get_auth_email());