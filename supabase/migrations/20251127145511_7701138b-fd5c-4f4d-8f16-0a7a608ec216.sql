-- Adicionar campo de preço à tabela ebd_revistas
ALTER TABLE ebd_revistas 
ADD COLUMN IF NOT EXISTS preco_cheio DECIMAL(10,2) DEFAULT 0;

-- Criar tabela para rastrear compras de revistas pelas igrejas
CREATE TABLE IF NOT EXISTS ebd_revistas_compradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  revista_id UUID NOT NULL REFERENCES ebd_revistas(id) ON DELETE CASCADE,
  preco_pago DECIMAL(10,2) NOT NULL,
  data_compra TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(church_id, revista_id)
);

-- RLS policies para ebd_revistas_compradas
ALTER TABLE ebd_revistas_compradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem gerenciar todas compras"
ON ebd_revistas_compradas
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners podem ver suas compras"
ON ebd_revistas_compradas
FOR SELECT
TO authenticated
USING (
  church_id IN (
    SELECT id FROM churches WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Church owners podem inserir suas compras"
ON ebd_revistas_compradas
FOR INSERT
TO authenticated
WITH CHECK (
  church_id IN (
    SELECT id FROM churches WHERE user_id = auth.uid()
  )
);