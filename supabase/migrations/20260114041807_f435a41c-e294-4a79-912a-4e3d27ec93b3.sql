-- Adicionar campos de NF-e na tabela vendas_balcao
ALTER TABLE vendas_balcao
ADD COLUMN IF NOT EXISTS nfe_id BIGINT,
ADD COLUMN IF NOT EXISTS nota_fiscal_numero TEXT,
ADD COLUMN IF NOT EXISTS nota_fiscal_chave TEXT,
ADD COLUMN IF NOT EXISTS nota_fiscal_url TEXT,
ADD COLUMN IF NOT EXISTS status_nfe TEXT;