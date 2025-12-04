-- Drop existing policy and create separate ones for clarity
DROP POLICY IF EXISTS "Admins can manage all vendedores" ON public.vendedores;

-- Create SELECT policy for admins
CREATE POLICY "Admins can select vendedores" 
ON public.vendedores 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'));

-- Create INSERT policy for admins
CREATE POLICY "Admins can insert vendedores" 
ON public.vendedores 
FOR INSERT 
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create UPDATE policy for admins
CREATE POLICY "Admins can update vendedores" 
ON public.vendedores 
FOR UPDATE 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Create DELETE policy for admins
CREATE POLICY "Admins can delete vendedores" 
ON public.vendedores 
FOR DELETE 
USING (public.has_role(auth.uid(), 'admin'));