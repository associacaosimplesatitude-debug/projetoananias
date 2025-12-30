-- Add RLS policy for professors to view their own escalas
CREATE POLICY "Professors can view their own escalas" 
ON public.ebd_escalas 
FOR SELECT 
USING (
  professor_id IN (
    SELECT id FROM ebd_professores 
    WHERE user_id = auth.uid() AND is_active = true
  )
);