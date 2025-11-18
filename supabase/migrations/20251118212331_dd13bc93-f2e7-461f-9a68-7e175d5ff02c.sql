-- Add explicit policies to deny anonymous access to sensitive tables

-- Deny anonymous access to profiles table
CREATE POLICY "deny_anonymous_access_profiles"
ON public.profiles
FOR SELECT
TO anon
USING (false);

-- Deny anonymous access to churches table
CREATE POLICY "deny_anonymous_access_churches"
ON public.churches
FOR SELECT
TO anon
USING (false);