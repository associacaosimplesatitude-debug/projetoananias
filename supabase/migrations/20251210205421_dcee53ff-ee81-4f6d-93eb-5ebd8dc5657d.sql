
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Leads can view their own record" ON public.ebd_leads_reativacao;
DROP POLICY IF EXISTS "Leads can update their login status" ON public.ebd_leads_reativacao;

-- Recreate as PERMISSIVE policies (default behavior, allows OR between policies)
CREATE POLICY "Leads can view their own record" 
ON public.ebd_leads_reativacao 
FOR SELECT 
TO authenticated
USING (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())));

CREATE POLICY "Leads can update their login status" 
ON public.ebd_leads_reativacao 
FOR UPDATE 
TO authenticated
USING (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())))
WITH CHECK (LOWER(email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid())));
