-- Adicionar campos na tabela ebd_quizzes
ALTER TABLE ebd_quizzes 
ADD COLUMN IF NOT EXISTS escala_id uuid REFERENCES ebd_escalas(id),
ADD COLUMN IF NOT EXISTS hora_liberacao time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS contexto text,
ADD COLUMN IF NOT EXISTS nivel text DEFAULT 'Médio';

-- Criar índice para buscar quizzes por escala
CREATE INDEX IF NOT EXISTS idx_ebd_quizzes_escala_id ON ebd_quizzes(escala_id);

-- Criar índice para buscar quizzes por turma e data
CREATE INDEX IF NOT EXISTS idx_ebd_quizzes_turma_data ON ebd_quizzes(turma_id, data_limite);