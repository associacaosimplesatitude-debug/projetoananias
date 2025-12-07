-- Add policy for vendedores to view their own record
CREATE POLICY "Vendedores can view their own record" 
ON public.vendedores 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));