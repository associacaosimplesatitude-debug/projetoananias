CREATE TABLE public.system_implementations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  implemented_at DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_implementations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read implementations"
ON public.system_implementations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert implementations"
ON public.system_implementations FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update implementations"
ON public.system_implementations FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete implementations"
ON public.system_implementations FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));