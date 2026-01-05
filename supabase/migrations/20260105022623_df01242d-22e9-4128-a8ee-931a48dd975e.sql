-- Allow promoted superintendents (ebd_user_roles) to read their church record

-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- Drop legacy policy if it exists to avoid duplicates (idempotent)
DROP POLICY IF EXISTS "Superintendentes can view assigned church" ON public.churches;

-- New policy: owner or superintendent role can SELECT church row
CREATE POLICY "Superintendentes can view assigned church"
ON public.churches
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.ebd_user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'superintendente'
      AND ur.church_id = public.churches.id
  )
);
