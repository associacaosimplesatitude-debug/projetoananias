-- Adicionar política para permitir que admins insiram igrejas
CREATE POLICY "Admins can insert churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));