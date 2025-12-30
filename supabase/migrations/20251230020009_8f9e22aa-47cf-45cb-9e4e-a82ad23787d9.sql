-- Add policy for EBD superintendents to manage their planejamentos
CREATE POLICY "Superintendentes podem gerenciar seus planejamentos"
ON public.ebd_planejamento
FOR ALL
TO authenticated
USING (
  church_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE superintendente_user_id = auth.uid()
  )
)
WITH CHECK (
  church_id IN (
    SELECT id FROM public.ebd_clientes
    WHERE superintendente_user_id = auth.uid()
  )
);