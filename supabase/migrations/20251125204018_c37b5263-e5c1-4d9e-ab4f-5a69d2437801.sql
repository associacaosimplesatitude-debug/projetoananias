-- Adicionar campo sem_aula na tabela ebd_escalas
ALTER TABLE ebd_escalas
ADD COLUMN sem_aula boolean NOT NULL DEFAULT false;

-- Adicionar comentário explicativo
COMMENT ON COLUMN ebd_escalas.sem_aula IS 'Indica se nesta data não haverá aula (feriado, santa ceia, etc)';