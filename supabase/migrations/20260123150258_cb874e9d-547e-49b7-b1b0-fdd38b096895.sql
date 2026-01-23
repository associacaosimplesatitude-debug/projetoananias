-- Remove old policy that only checks professor_id
DROP POLICY IF EXISTS "Professors can view their own escalas" ON public.ebd_escalas;

-- Create new policy that checks BOTH professor_id and professor_id_2
CREATE POLICY "Professors can view their own escalas"
ON public.ebd_escalas
FOR SELECT
USING (
  professor_id IN (
    SELECT id FROM ebd_professores 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
  OR 
  professor_id_2 IN (
    SELECT id FROM ebd_professores 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);