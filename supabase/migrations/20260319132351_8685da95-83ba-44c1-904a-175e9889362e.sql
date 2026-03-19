
-- 1. sorteio_sessoes
CREATE TABLE sorteio_sessoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  data_inicio timestamptz NOT NULL,
  data_fim timestamptz NOT NULL,
  intervalo_minutos int NOT NULL DEFAULT 60,
  ativo boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. sorteio_participantes
CREATE TABLE sorteio_participantes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text NOT NULL,
  cidade text,
  igreja text,
  sessao_id uuid REFERENCES sorteio_sessoes(id),
  quer_ser_embaixadora boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(whatsapp),
  UNIQUE(email)
);
CREATE INDEX ON sorteio_participantes(sessao_id);
CREATE INDEX ON sorteio_participantes(whatsapp);
CREATE INDEX ON sorteio_participantes(email);

-- 3. sorteio_ganhadores
CREATE TABLE sorteio_ganhadores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participante_id uuid REFERENCES sorteio_participantes(id),
  sessao_id uuid REFERENCES sorteio_sessoes(id),
  sorteado_em timestamptz DEFAULT now(),
  status text DEFAULT 'aguardando',
  premio_descricao text,
  expira_em timestamptz,
  confirmado_em timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON sorteio_ganhadores(sessao_id);
CREATE INDEX ON sorteio_ganhadores(status);
CREATE INDEX ON sorteio_ganhadores(sorteado_em DESC);

-- 4. embaixadoras_tiers
CREATE TABLE embaixadoras_tiers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  volume_minimo numeric DEFAULT 0,
  volume_maximo numeric,
  percentual_comissao numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);
INSERT INTO embaixadoras_tiers (nome, volume_minimo, volume_maximo, percentual_comissao) VALUES
  ('Iniciante', 0, 499.99, 5),
  ('Ativa', 500, 1499.99, 8),
  ('Premium', 1500, NULL, 12);

-- 5. embaixadoras
CREATE TABLE embaixadoras (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  participante_id uuid REFERENCES sorteio_participantes(id),
  nome text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp text NOT NULL,
  codigo_unico text NOT NULL UNIQUE,
  status text DEFAULT 'pendente',
  tier_id uuid REFERENCES embaixadoras_tiers(id),
  total_vendas numeric DEFAULT 0,
  total_comissao numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON embaixadoras(codigo_unico);
CREATE INDEX ON embaixadoras(status);

-- 6. embaixadoras_cliques
CREATE TABLE embaixadoras_cliques (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  embaixadora_id uuid REFERENCES embaixadoras(id),
  ip_hash text,
  referrer text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON embaixadoras_cliques(embaixadora_id);
CREATE INDEX ON embaixadoras_cliques(created_at DESC);

-- 7. embaixadoras_vendas
CREATE TABLE embaixadoras_vendas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  embaixadora_id uuid REFERENCES embaixadoras(id),
  pedido_id text,
  canal text,
  valor_venda numeric NOT NULL,
  percentual_comissao numeric NOT NULL,
  valor_comissao numeric NOT NULL,
  status text DEFAULT 'pendente',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON embaixadoras_vendas(embaixadora_id);
CREATE INDEX ON embaixadoras_vendas(status);

-- RLS: sorteio_participantes
ALTER TABLE sorteio_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_publico" ON sorteio_participantes FOR INSERT WITH CHECK (true);
CREATE POLICY "select_admin" ON sorteio_participantes FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS: sorteio_ganhadores
ALTER TABLE sorteio_ganhadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_publico_ganhadores" ON sorteio_ganhadores FOR SELECT USING (true);
CREATE POLICY "insert_admin_ganhadores" ON sorteio_ganhadores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "update_admin_ganhadores" ON sorteio_ganhadores FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS: sorteio_sessoes
ALTER TABLE sorteio_sessoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_publico_sessoes" ON sorteio_sessoes FOR SELECT USING (true);
CREATE POLICY "admin_insert_sessoes" ON sorteio_sessoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_update_sessoes" ON sorteio_sessoes FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_sessoes" ON sorteio_sessoes FOR DELETE USING (auth.uid() IS NOT NULL);

-- RLS: embaixadoras
ALTER TABLE embaixadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_publico_embaixadoras" ON embaixadoras FOR SELECT USING (true);
CREATE POLICY "insert_embaixadoras" ON embaixadoras FOR INSERT WITH CHECK (true);
CREATE POLICY "update_admin_embaixadoras" ON embaixadoras FOR UPDATE USING (auth.uid() IS NOT NULL);

-- RLS: embaixadoras_cliques
ALTER TABLE embaixadoras_cliques ENABLE ROW LEVEL SECURITY;
CREATE POLICY "insert_publico_cliques" ON embaixadoras_cliques FOR INSERT WITH CHECK (true);
CREATE POLICY "select_admin_cliques" ON embaixadoras_cliques FOR SELECT USING (auth.uid() IS NOT NULL);

-- RLS: embaixadoras_vendas
ALTER TABLE embaixadoras_vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all_admin_vendas" ON embaixadoras_vendas FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS: embaixadoras_tiers
ALTER TABLE embaixadoras_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_publico_tiers" ON embaixadoras_tiers FOR SELECT USING (true);
CREATE POLICY "admin_insert_tiers" ON embaixadoras_tiers FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin_update_tiers" ON embaixadoras_tiers FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "admin_delete_tiers" ON embaixadoras_tiers FOR DELETE USING (auth.uid() IS NOT NULL);
