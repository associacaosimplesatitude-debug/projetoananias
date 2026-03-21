
CREATE TABLE public.sorteio_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id uuid REFERENCES public.sorteio_sessoes(id) ON DELETE SET NULL,
  ip_hash text,
  user_agent text,
  referrer text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.sorteio_page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert page views"
  ON public.sorteio_page_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can view page views"
  ON public.sorteio_page_views FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
