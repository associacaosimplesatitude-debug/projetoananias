CREATE POLICY "SE can view own student licenses"
ON public.revista_licencas_shopify
FOR SELECT
TO authenticated
USING (
  shopify_order_id LIKE 'SE-%'
  AND EXISTS (
    SELECT 1
    FROM public.revista_licenca_alunos rla
    JOIN public.ebd_clientes ec ON ec.id = rla.superintendente_id
    WHERE ec.superintendente_user_id = auth.uid()
      AND public.revista_licencas_shopify.shopify_order_id = 'SE-' || rla.id::text
  )
);