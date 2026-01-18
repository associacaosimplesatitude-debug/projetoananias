
-- RLS policies for vendedor_propostas to allow superintendentes to manage their own proposals

-- Policy: Superintendente can INSERT proposals for their own client
CREATE POLICY "superintendente_insert_own_proposals"
ON public.vendedor_propostas
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_ebd_superintendente_for_church(auth.uid(), cliente_id)
  AND vendedor_id = (SELECT vendedor_id FROM public.ebd_clientes WHERE id = cliente_id)
);

-- Policy: Superintendente can SELECT their own proposals
CREATE POLICY "superintendente_select_own_proposals"
ON public.vendedor_propostas
FOR SELECT
TO authenticated
USING (
  public.is_ebd_superintendente_for_church(auth.uid(), cliente_id)
);

-- Policy: Superintendente can UPDATE their own proposals
CREATE POLICY "superintendente_update_own_proposals"
ON public.vendedor_propostas
FOR UPDATE
TO authenticated
USING (
  public.is_ebd_superintendente_for_church(auth.uid(), cliente_id)
)
WITH CHECK (
  public.is_ebd_superintendente_for_church(auth.uid(), cliente_id)
);
