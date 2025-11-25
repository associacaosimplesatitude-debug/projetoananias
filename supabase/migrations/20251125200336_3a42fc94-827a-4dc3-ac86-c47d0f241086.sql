-- Permitir church_id NULL em ebd_licoes para revistas globais
ALTER TABLE ebd_licoes ALTER COLUMN church_id DROP NOT NULL;

-- Atualizar lições existentes de revistas globais
UPDATE ebd_licoes 
SET church_id = NULL 
WHERE church_id = '00000000-0000-0000-0000-000000000000';

-- Adicionar um check para garantir que lições tenham church_id OU revista_id
ALTER TABLE ebd_licoes 
ADD CONSTRAINT ebd_licoes_church_or_revista_check 
CHECK (
  (church_id IS NOT NULL AND revista_id IS NULL) OR 
  (church_id IS NULL AND revista_id IS NOT NULL)
);