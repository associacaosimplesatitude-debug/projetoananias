-- 1. Deletar o registro órfão específico do Evair (igreja que não existe mais)
DELETE FROM ebd_user_roles 
WHERE id = '6ddc66a3-1af2-477c-a158-da9222749fd2';

-- 2. Limpar TODOS os registros órfãos que apontam para igrejas inexistentes
DELETE FROM ebd_user_roles
WHERE church_id NOT IN (SELECT id FROM ebd_clientes);

-- 3. Adicionar Foreign Key constraint para prevenir futuros registros órfãos
ALTER TABLE ebd_user_roles
ADD CONSTRAINT fk_ebd_user_roles_church_id 
FOREIGN KEY (church_id) 
REFERENCES ebd_clientes(id) 
ON DELETE CASCADE;