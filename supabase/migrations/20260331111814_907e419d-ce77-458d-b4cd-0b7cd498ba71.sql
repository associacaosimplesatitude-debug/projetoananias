
-- TABELA 1: licenças de compra direta via Shopify
CREATE TABLE revista_licencas_shopify (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revista_id uuid REFERENCES revistas_digitais(id) ON DELETE SET NULL,
  shopify_order_id text,
  shopify_order_number text,
  nome_comprador text,
  whatsapp text NOT NULL,
  email text,
  ativo boolean DEFAULT true,
  expira_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE revista_licencas_shopify ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON revista_licencas_shopify
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "admin_select" ON revista_licencas_shopify
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- TABELA 2: OTPs de acesso por WhatsApp
CREATE TABLE revista_otp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp text NOT NULL,
  codigo text NOT NULL,
  expira_em timestamptz NOT NULL,
  usado boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE revista_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON revista_otp
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_revista_otp_lookup 
  ON revista_otp(whatsapp, codigo, usado, expira_em);
