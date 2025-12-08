-- Adicionar políticas para vendedores poderem criar e ver pedidos de seus clientes (ebd_clientes)

-- Política para vendedores verem pedidos de seus clientes
CREATE POLICY "Vendedores podem ver pedidos de seus clientes"
ON public.ebd_pedidos
FOR SELECT
USING (
  church_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Política para vendedores criarem pedidos para seus clientes
CREATE POLICY "Vendedores podem criar pedidos para seus clientes"
ON public.ebd_pedidos
FOR INSERT
WITH CHECK (
  church_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Política para vendedores verem itens dos pedidos de seus clientes
CREATE POLICY "Vendedores podem ver itens dos pedidos de seus clientes"
ON public.ebd_pedidos_itens
FOR SELECT
USING (
  pedido_id IN (
    SELECT id FROM public.ebd_pedidos
    WHERE church_id IN (
      SELECT id FROM public.ebd_clientes
      WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
    )
  )
);

-- Política para vendedores criarem itens dos pedidos de seus clientes
CREATE POLICY "Vendedores podem criar itens dos pedidos de seus clientes"
ON public.ebd_pedidos_itens
FOR INSERT
WITH CHECK (
  pedido_id IN (
    SELECT id FROM public.ebd_pedidos
    WHERE church_id IN (
      SELECT id FROM public.ebd_clientes
      WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
    )
  )
);