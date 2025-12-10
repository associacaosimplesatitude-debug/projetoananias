
-- Drop existing policy
DROP POLICY IF EXISTS "Leads can view their own record" ON public.ebd_leads_reativacao;
DROP POLICY IF EXISTS "Leads can update their login status" ON public.ebd_leads_reativacao;

-- Create case-insensitive policies
CREATE POLICY "Leads can view their own record" 
ON public.ebd_leads_reativacao 
FOR SELECT 
USING (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "Leads can update their login status" 
ON public.ebd_leads_reativacao 
FOR UPDATE 
USING (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
WITH CHECK (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())));
