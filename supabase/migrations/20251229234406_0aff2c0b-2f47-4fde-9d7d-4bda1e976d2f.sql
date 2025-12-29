-- Tabela para mapeamento de SKUs/produtos para revistas internas
CREATE TABLE public.ebd_produto_revista_mapping (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  revista_id uuid NOT NULL REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
  sku text,
  product_title text,
  bling_produto_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(sku),
  UNIQUE(bling_produto_id)
);

-- Índices para busca rápida
CREATE INDEX idx_ebd_produto_mapping_sku ON public.ebd_produto_revista_mapping(sku);
CREATE INDEX idx_ebd_produto_mapping_bling ON public.ebd_produto_revista_mapping(bling_produto_id);
CREATE INDEX idx_ebd_produto_mapping_title ON public.ebd_produto_revista_mapping(product_title);

-- Enable RLS
ALTER TABLE public.ebd_produto_revista_mapping ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all mappings"
ON public.ebd_produto_revista_mapping FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view mappings"
ON public.ebd_produto_revista_mapping FOR SELECT
USING (true);

-- Tabela para rastrear progresso de onboarding do cliente EBD
CREATE TABLE public.ebd_onboarding_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  etapa_id integer NOT NULL CHECK (etapa_id >= 1 AND etapa_id <= 5),
  completada boolean NOT NULL DEFAULT false,
  completada_em timestamp with time zone,
  revista_identificada_id uuid REFERENCES public.ebd_revistas(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(church_id, etapa_id)
);

-- Índices
CREATE INDEX idx_ebd_onboarding_church ON public.ebd_onboarding_progress(church_id);

-- Enable RLS
ALTER TABLE public.ebd_onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins can manage all onboarding"
ON public.ebd_onboarding_progress FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can view and update their onboarding"
ON public.ebd_onboarding_progress FOR ALL
USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Adicionar campo de desconto de onboarding na tabela ebd_clientes
ALTER TABLE public.ebd_clientes 
ADD COLUMN IF NOT EXISTS desconto_onboarding numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS onboarding_concluido boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_concluido_em timestamp with time zone;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_ebd_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ebd_onboarding_progress_updated_at
  BEFORE UPDATE ON public.ebd_onboarding_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ebd_onboarding_updated_at();

CREATE TRIGGER update_ebd_produto_revista_mapping_updated_at
  BEFORE UPDATE ON public.ebd_produto_revista_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ebd_onboarding_updated_at();

-- Habilitar Realtime para atualizações em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.ebd_onboarding_progress;