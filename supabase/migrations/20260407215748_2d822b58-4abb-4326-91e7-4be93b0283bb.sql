ALTER TABLE revista_licencas_shopify ADD COLUMN IF NOT EXISTS versao_preferida text DEFAULT 'cg_digital';

ALTER TABLE revistas_digitais ADD COLUMN IF NOT EXISTS video_celular_cg_digital text;
ALTER TABLE revistas_digitais ADD COLUMN IF NOT EXISTS video_desktop_cg_digital text;
ALTER TABLE revistas_digitais ADD COLUMN IF NOT EXISTS video_celular_leitor text;
ALTER TABLE revistas_digitais ADD COLUMN IF NOT EXISTS video_desktop_leitor text;