-- Adicionar campo tipo_material ao mapeamento de produtos
ALTER TABLE public.ebd_produto_revista_mapping 
ADD COLUMN IF NOT EXISTS tipo_material text DEFAULT 'BASE' CHECK (tipo_material IN ('BASE', 'SUPORTE'));

-- Adicionar campo para data de aniversário e cupom no progresso de onboarding
ALTER TABLE public.ebd_onboarding_progress 
DROP CONSTRAINT IF EXISTS ebd_onboarding_progress_etapa_id_check;

ALTER TABLE public.ebd_onboarding_progress 
ADD CONSTRAINT ebd_onboarding_progress_etapa_id_check CHECK (etapa_id >= 1 AND etapa_id <= 6);

-- Adicionar campos de aniversário e cupom na tabela ebd_clientes
ALTER TABLE public.ebd_clientes 
ADD COLUMN IF NOT EXISTS cupom_aniversario_usado boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS cupom_aniversario_ano integer;

-- Índice para tipo_material
CREATE INDEX IF NOT EXISTS idx_ebd_produto_mapping_tipo ON public.ebd_produto_revista_mapping(tipo_material);