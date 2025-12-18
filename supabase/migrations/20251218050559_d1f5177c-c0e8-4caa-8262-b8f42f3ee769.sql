-- Add DELETE policy for gerente_ebd on ebd_clientes
CREATE POLICY "Gerente EBD can delete ebd_clientes"
ON public.ebd_clientes
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add UPDATE policy for gerente_ebd on ebd_clientes
CREATE POLICY "Gerente EBD can update ebd_clientes"
ON public.ebd_clientes
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add DELETE policy for gerente_ebd on churches
CREATE POLICY "Gerente EBD can delete churches"
ON public.churches
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add UPDATE policy for gerente_ebd on churches
CREATE POLICY "Gerente EBD can update churches"
ON public.churches
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));