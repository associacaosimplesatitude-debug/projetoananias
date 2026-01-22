-- Remover a foreign key constraint para permitir church_id referenciar tanto churches quanto ebd_clientes
-- Isso é necessário porque o sistema suporta ambos os tipos de clientes
ALTER TABLE public.ebd_alunos 
DROP CONSTRAINT IF EXISTS ebd_alunos_church_id_fkey;