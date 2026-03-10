ALTER TABLE vendedor_propostas 
  ADD COLUMN IF NOT EXISTS documento_invalido boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS documento_invalido_motivo text;