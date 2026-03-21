DROP POLICY "Admins can view page views" ON public.sorteio_page_views;

CREATE POLICY "Admins and gerente_sorteio can view page views"
  ON public.sorteio_page_views FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.has_role(auth.uid(), 'gerente_sorteio')
  );