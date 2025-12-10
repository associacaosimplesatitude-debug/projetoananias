-- Drop the problematic policies that query auth.users directly
DROP POLICY IF EXISTS "Leads can update their login status" ON public.ebd_leads_reativacao;
DROP POLICY IF EXISTS "Leads can view their own record" ON public.ebd_leads_reativacao;

-- Recreate policies using get_auth_email() function instead of querying auth.users directly
CREATE POLICY "Leads can view their own record" ON public.ebd_leads_reativacao
FOR SELECT
USING (lower(email) = lower(get_auth_email()));

CREATE POLICY "Leads can update their login status" ON public.ebd_leads_reativacao
FOR UPDATE
USING (lower(email) = lower(get_auth_email()))
WITH CHECK (lower(email) = lower(get_auth_email()));