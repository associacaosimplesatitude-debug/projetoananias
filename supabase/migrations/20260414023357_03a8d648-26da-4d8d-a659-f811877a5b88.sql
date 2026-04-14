ALTER TABLE sorteio_sessoes ADD COLUMN slug text;
CREATE UNIQUE INDEX idx_sorteio_sessoes_slug ON sorteio_sessoes(slug) WHERE slug IS NOT NULL;