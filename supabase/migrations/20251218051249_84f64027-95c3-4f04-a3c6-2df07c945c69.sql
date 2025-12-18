-- Add UPDATE policy for gerente_ebd on ebd_shopify_pedidos
CREATE POLICY "Gerente EBD can update ebd_shopify_pedidos"
ON public.ebd_shopify_pedidos
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add DELETE policy for gerente_ebd on ebd_shopify_pedidos
CREATE POLICY "Gerente EBD can delete ebd_shopify_pedidos"
ON public.ebd_shopify_pedidos
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));