-- Allow church members to view mandates for their church
CREATE POLICY "Members can view their church mandates"
ON public.board_mandates
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.church_id = board_mandates.church_id
  )
);