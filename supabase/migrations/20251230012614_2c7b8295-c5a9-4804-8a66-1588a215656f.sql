-- Remover FK rígida para permitir church_id apontar para churches (assinaturas) OU ebd_clientes (módulo EBD)
ALTER TABLE public.ebd_turmas
DROP CONSTRAINT IF EXISTS ebd_turmas_church_id_fkey;