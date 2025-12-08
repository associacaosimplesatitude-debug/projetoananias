-- Add DELETE policy for vendedores on ebd_clientes table
CREATE POLICY "Vendedores can delete their own clientes" 
ON public.ebd_clientes 
FOR DELETE 
USING (vendedor_id = get_vendedor_id_by_email(get_auth_email()));