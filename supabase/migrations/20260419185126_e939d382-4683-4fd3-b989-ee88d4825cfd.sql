-- Tabela de contas MP conectadas via OAuth (espelha schema da Central Gospel Store)
CREATE TABLE public.mp_connected_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  public_key text,
  live_mode boolean DEFAULT false,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mp_connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mp_connected_accounts"
  ON public.mp_connected_accounts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at (reaproveita função já existente)
CREATE TRIGGER update_mp_connected_accounts_updated_at
  BEFORE UPDATE ON public.mp_connected_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ebd_onboarding_updated_at();

-- Coluna application_fee em ebd_shopify_pedidos_mercadopago
ALTER TABLE public.ebd_shopify_pedidos_mercadopago
  ADD COLUMN IF NOT EXISTS application_fee numeric(12,2);