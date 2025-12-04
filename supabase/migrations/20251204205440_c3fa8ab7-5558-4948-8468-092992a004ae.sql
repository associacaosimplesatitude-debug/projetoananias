-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Admins can manage all vendedores" ON public.vendedores;

-- Create proper RLS policy using the has_role function
CREATE POLICY "Admins can manage all vendedores" 
ON public.vendedores 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));