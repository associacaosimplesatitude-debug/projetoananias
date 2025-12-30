-- Adicionar políticas para superintendentes poderem criar e atualizar progresso de onboarding
CREATE POLICY "Superintendentes can insert onboarding progress" 
ON public.ebd_onboarding_progress 
FOR INSERT 
WITH CHECK (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);

CREATE POLICY "Superintendentes can update onboarding progress" 
ON public.ebd_onboarding_progress 
FOR UPDATE 
USING (
  church_id IN (
    SELECT id FROM ebd_clientes 
    WHERE superintendente_user_id = auth.uid()
  )
);