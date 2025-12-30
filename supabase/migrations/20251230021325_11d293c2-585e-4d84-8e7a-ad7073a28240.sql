-- Remover FK restritiva que impede uso de ebd_clientes.id como church_id
ALTER TABLE public.ebd_escalas DROP CONSTRAINT ebd_escalas_church_id_fkey;