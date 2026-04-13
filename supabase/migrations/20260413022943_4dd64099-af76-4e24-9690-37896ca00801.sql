
CREATE TABLE public.stripe_test_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_intent_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  fee_amount NUMERIC NOT NULL DEFAULT 0,
  net_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDENTE',
  description TEXT,
  stripe_event TEXT,
  raw_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read stripe_test_logs"
  ON public.stripe_test_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admin can insert stripe_test_logs"
  ON public.stripe_test_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Also allow anon inserts for webhook (service role will be used)
CREATE POLICY "Service can insert stripe_test_logs"
  ON public.stripe_test_logs FOR INSERT
  TO anon
  WITH CHECK (true);
