
-- Permite que leads visualizem seu próprio registro pelo email
CREATE POLICY "Leads can view their own record" 
ON public.ebd_leads_reativacao 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Permite que leads atualizem campos específicos do seu registro (ultimo_login_ebd, lead_score)
CREATE POLICY "Leads can update their login status" 
ON public.ebd_leads_reativacao 
FOR UPDATE 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()))
WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()));
