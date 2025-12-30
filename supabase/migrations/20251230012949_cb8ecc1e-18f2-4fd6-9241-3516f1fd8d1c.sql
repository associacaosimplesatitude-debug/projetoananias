-- Remover FK rígida para ebd_onboarding_progress (mesma situação de ebd_turmas)
ALTER TABLE public.ebd_onboarding_progress
DROP CONSTRAINT IF EXISTS ebd_onboarding_progress_church_id_fkey;

-- Atualizar check constraint para permitir etapa 7 (Configurar Lançamento)
ALTER TABLE public.ebd_onboarding_progress
DROP CONSTRAINT IF EXISTS ebd_onboarding_progress_etapa_id_check;

ALTER TABLE public.ebd_onboarding_progress
ADD CONSTRAINT ebd_onboarding_progress_etapa_id_check CHECK ((etapa_id >= 1) AND (etapa_id <= 7));