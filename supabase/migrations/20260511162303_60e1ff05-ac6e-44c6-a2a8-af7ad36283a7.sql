ALTER TABLE agente_ia_conversas
  ADD COLUMN IF NOT EXISTS agente_pausado boolean NOT NULL DEFAULT false;

UPDATE agente_ia_conversas
SET agente_pausado = true, status = 'ativa'
WHERE status = 'pausada_humano';

UPDATE agente_ia_conversas
SET status = 'ativa', agente_pausado = false
WHERE status = 'escalada';

CREATE INDEX IF NOT EXISTS idx_agente_ia_conv_pausado
  ON agente_ia_conversas(agente_pausado) WHERE agente_pausado = true;