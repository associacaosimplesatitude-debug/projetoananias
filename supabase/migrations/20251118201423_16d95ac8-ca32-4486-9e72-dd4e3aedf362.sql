-- Remover política antiga que não estava funcionando
DROP POLICY IF EXISTS "Admins can insert churches" ON public.churches;

-- Criar política correta para permitir que admins insiram igrejas com qualquer user_id
CREATE POLICY "Admins can insert churches"
ON public.churches
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
);