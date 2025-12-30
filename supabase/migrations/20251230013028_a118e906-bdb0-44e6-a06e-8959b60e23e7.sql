-- Adicionar política de SELECT para superintendentes verem seu progresso de onboarding
CREATE POLICY "Superintendentes can select onboarding progress" 
ON public.ebd_onboarding_progress 
FOR SELECT 
USING (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);