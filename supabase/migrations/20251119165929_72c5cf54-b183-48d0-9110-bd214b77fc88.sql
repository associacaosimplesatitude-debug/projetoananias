-- Allow church owners (clients) to manage their own stage progress entries
CREATE POLICY "Clients can insert their progress"
ON public.church_stage_progress
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE churches.id = church_stage_progress.church_id
      AND churches.user_id = auth.uid()
  )
);

CREATE POLICY "Clients can update their progress"
ON public.church_stage_progress
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE churches.id = church_stage_progress.church_id
      AND churches.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.churches
    WHERE churches.id = church_stage_progress.church_id
      AND churches.user_id = auth.uid()
  )
);