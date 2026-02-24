
-- 1. Create google_ads_invoices table
CREATE TABLE public.google_ads_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_month int NOT NULL CHECK (competencia_month BETWEEN 1 AND 12),
  competencia_year int NOT NULL,
  customer_id text NOT NULL,
  invoice_number text,
  issue_date date,
  amount numeric(12,2),
  currency text DEFAULT 'BRL',
  status text NOT NULL DEFAULT 'PENDENTE',
  pdf_url text,
  pdf_filename text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT google_ads_invoices_unique UNIQUE (competencia_month, competencia_year, customer_id)
);

-- 2. Create google_ads_topups table
CREATE TABLE public.google_ads_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  requested_by uuid NOT NULL,
  requested_amount numeric(12,2) NOT NULL,
  requested_at timestamptz DEFAULT now(),
  cost_center text,
  request_note text,
  pix_code text,
  pix_qr_url text,
  pix_expires_at timestamptz,
  provided_by uuid,
  provided_at timestamptz,
  paid_marked_by uuid,
  paid_marked_at timestamptz,
  payment_proof_url text,
  payment_proof_filename text,
  status text NOT NULL DEFAULT 'SOLICITADA',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- 3. Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_google_ads_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_google_ads_invoices_updated_at
  BEFORE UPDATE ON public.google_ads_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_google_ads_updated_at();

CREATE TRIGGER update_google_ads_topups_updated_at
  BEFORE UPDATE ON public.google_ads_topups
  FOR EACH ROW EXECUTE FUNCTION public.update_google_ads_updated_at();

-- 4. Helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin_geral(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_financeiro_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'financeiro')
  )
$$;

-- 5. Enable RLS
ALTER TABLE public.google_ads_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_topups ENABLE ROW LEVEL SECURITY;

-- 6. RLS for google_ads_invoices
CREATE POLICY "admin_all_invoices" ON public.google_ads_invoices
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "financeiro_select_invoices" ON public.google_ads_invoices
  FOR SELECT TO authenticated
  USING (public.is_financeiro_or_admin(auth.uid()));

-- 7. RLS for google_ads_topups
CREATE POLICY "admin_all_topups" ON public.google_ads_topups
  FOR ALL TO authenticated
  USING (public.is_admin_geral(auth.uid()))
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "financeiro_select_topups" ON public.google_ads_topups
  FOR SELECT TO authenticated
  USING (public.is_financeiro_or_admin(auth.uid()));

CREATE POLICY "financeiro_insert_topups" ON public.google_ads_topups
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_financeiro_or_admin(auth.uid())
    AND requested_by = auth.uid()
  );

CREATE POLICY "financeiro_update_topups" ON public.google_ads_topups
  FOR UPDATE TO authenticated
  USING (
    public.is_financeiro_or_admin(auth.uid())
    AND status IN ('PIX_DISPONIVEL', 'AGUARDANDO_PAGAMENTO')
  )
  WITH CHECK (
    public.is_financeiro_or_admin(auth.uid())
  );

-- 8. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('google_docs', 'google_docs', false)
ON CONFLICT (id) DO NOTHING;

-- 9. Storage policies
CREATE POLICY "admin_select_google_docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'google_docs' AND public.is_financeiro_or_admin(auth.uid()));

CREATE POLICY "admin_insert_google_docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'google_docs' AND public.is_admin_geral(auth.uid()));

CREATE POLICY "financeiro_insert_comprovantes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'google_docs'
    AND public.is_financeiro_or_admin(auth.uid())
    AND (storage.foldername(name))[1] = 'topups'
  );

CREATE POLICY "admin_update_google_docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'google_docs' AND public.is_admin_geral(auth.uid()));

CREATE POLICY "admin_delete_google_docs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'google_docs' AND public.is_admin_geral(auth.uid()));
