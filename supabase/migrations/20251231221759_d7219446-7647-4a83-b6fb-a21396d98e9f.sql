-- Add RLS policies for vendedores to manage addresses of their clients

-- Policy: Vendedores can view addresses of their clients
CREATE POLICY "Vendedores can view addresses of their clients"
ON public.ebd_endereco_entrega
FOR SELECT
USING (
  user_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Policy: Vendedores can insert addresses for their clients
CREATE POLICY "Vendedores can insert addresses for their clients"
ON public.ebd_endereco_entrega
FOR INSERT
WITH CHECK (
  user_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Policy: Vendedores can update addresses of their clients
CREATE POLICY "Vendedores can update addresses of their clients"
ON public.ebd_endereco_entrega
FOR UPDATE
USING (
  user_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Policy: Vendedores can delete addresses of their clients
CREATE POLICY "Vendedores can delete addresses of their clients"
ON public.ebd_endereco_entrega
FOR DELETE
USING (
  user_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Policy: Gerente EBD can manage all addresses
CREATE POLICY "Gerente EBD can manage all addresses"
ON public.ebd_endereco_entrega
FOR ALL
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));