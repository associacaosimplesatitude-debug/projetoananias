-- Adicionar coluna turma_id ao ebd_planejamento
ALTER TABLE ebd_planejamento 
ADD COLUMN turma_id uuid REFERENCES ebd_turmas(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX idx_ebd_planejamento_turma_id ON ebd_planejamento(turma_id);

-- Atualizar planejamentos existentes com a turma_id baseado nas escalas associadas
UPDATE ebd_planejamento p
SET turma_id = (
  SELECT DISTINCT e.turma_id
  FROM ebd_escalas e
  WHERE e.church_id = p.church_id
    AND e.data >= p.data_inicio
    AND e.data <= p.data_termino
    AND e.turma_id IS NOT NULL
  LIMIT 1
)
WHERE p.turma_id IS NULL;