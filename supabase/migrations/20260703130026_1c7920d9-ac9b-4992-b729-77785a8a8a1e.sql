
-- Config de depósitos do Bling (CEP de origem por depósito)
CREATE TABLE IF NOT EXISTS public.bling_depositos_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bling_deposito_id BIGINT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  cep_origem TEXT NOT NULL,
  cidade TEXT,
  estado TEXT,
  ativo_pdv BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bling_depositos_config TO authenticated;
GRANT ALL ON public.bling_depositos_config TO service_role;

ALTER TABLE public.bling_depositos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ler depositos config"
ON public.bling_depositos_config FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Superadmin gerencia depositos config"
ON public.bling_depositos_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Colunas em vendedor_propostas para rastrear depósito de origem
ALTER TABLE public.vendedor_propostas
  ADD COLUMN IF NOT EXISTS deposito_id BIGINT,
  ADD COLUMN IF NOT EXISTS deposito_nome TEXT,
  ADD COLUMN IF NOT EXISTS cep_origem_frete TEXT,
  ADD COLUMN IF NOT EXISTS proposta_grupo_id UUID;

COMMENT ON COLUMN public.vendedor_propostas.deposito_id IS 'ID do depósito Bling de onde os itens serão despachados';
COMMENT ON COLUMN public.vendedor_propostas.cep_origem_frete IS 'CEP de origem para cálculo do frete, baseado no depósito';
COMMENT ON COLUMN public.vendedor_propostas.proposta_grupo_id IS 'Agrupa propostas geradas em conjunto (split entre depósitos)';

-- Seed com os depósitos conhecidos (idempotente).
-- Os IDs reais do Bling devem ser preenchidos manualmente após primeira sincronização;
-- para não bloquear o fluxo, insere-se pelos NOMES canônicos.
INSERT INTO public.bling_depositos_config (bling_deposito_id, nome, cep_origem, cidade, estado, ordem)
VALUES
  (0, 'Geral', '22713-001', 'Rio de Janeiro', 'RJ', 1),
  (0, 'LOJA PENHA', '21020-002', 'Rio de Janeiro', 'RJ', 2),
  (0, 'PERNANBUCO [ALFA]', '54315-110', 'Jaboatão dos Guararapes', 'PE', 3)
ON CONFLICT (bling_deposito_id) DO NOTHING;

-- Como (0) fica em conflito para as 3 linhas, garante ao menos uma:
-- ajustar de forma que cada linha use um bling_deposito_id único negativo temporário
-- (será atualizado quando o backend retornar os IDs reais).
DO $$
DECLARE
  v_cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cnt FROM public.bling_depositos_config;
  IF v_cnt < 3 THEN
    -- Reset: insere com IDs temporários únicos negativos
    DELETE FROM public.bling_depositos_config WHERE bling_deposito_id = 0;
    INSERT INTO public.bling_depositos_config (bling_deposito_id, nome, cep_origem, cidade, estado, ordem)
    VALUES
      (-1, 'Geral', '22713-001', 'Rio de Janeiro', 'RJ', 1),
      (-2, 'LOJA PENHA', '21020-002', 'Rio de Janeiro', 'RJ', 2),
      (-3, 'PERNANBUCO [ALFA]', '54315-110', 'Jaboatão dos Guararapes', 'PE', 3)
    ON CONFLICT (bling_deposito_id) DO NOTHING;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_bling_depositos_config_updated_at ON public.bling_depositos_config;
CREATE TRIGGER update_bling_depositos_config_updated_at
BEFORE UPDATE ON public.bling_depositos_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
