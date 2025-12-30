-- Remover a FK que aponta para churches pois ebd_professores 
-- precisa aceitar IDs de ebd_clientes (não de churches)
ALTER TABLE public.ebd_professores DROP CONSTRAINT IF EXISTS ebd_professores_church_id_fkey;