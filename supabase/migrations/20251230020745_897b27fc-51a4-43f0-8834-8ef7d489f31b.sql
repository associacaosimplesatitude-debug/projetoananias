-- Permitir professor_id ser null para escalas marcadas como sem_aula
ALTER TABLE public.ebd_escalas ALTER COLUMN professor_id DROP NOT NULL;