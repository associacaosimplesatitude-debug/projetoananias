-- Allow public inserts on ebd_leads_reativacao for landing page form submissions
CREATE POLICY "Allow public insert for landing page leads"
ON public.ebd_leads_reativacao
FOR INSERT
WITH CHECK (true);