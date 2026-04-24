
-- 1. Tabela de eventos
CREATE TABLE public.sorteio_eventos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  slug TEXT UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT false,
  banner_url TEXT,
  titulo TEXT,
  subtitulo TEXT,
  descricao TEXT,
  premio_destaque TEXT,
  cor_primaria TEXT DEFAULT '#D4AF37',
  texto_botao_cta TEXT DEFAULT 'Quero participar',
  mostrar_campo_embaixadora BOOLEAN NOT NULL DEFAULT true,
  data_inicio TIMESTAMPTZ,
  data_fim TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sorteio_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_publico_eventos" ON public.sorteio_eventos
  FOR SELECT USING (true);

CREATE POLICY "admin_insert_eventos" ON public.sorteio_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role));

CREATE POLICY "admin_update_eventos" ON public.sorteio_eventos
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role));

CREATE POLICY "admin_delete_eventos" ON public.sorteio_eventos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role));

-- 2. Trigger updated_at
CREATE TRIGGER update_sorteio_eventos_updated_at
  BEFORE UPDATE ON public.sorteio_eventos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Trigger garantindo apenas 1 evento ativo
CREATE OR REPLACE FUNCTION public.ensure_single_active_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo = true THEN
    UPDATE public.sorteio_eventos
    SET ativo = false
    WHERE id <> NEW.id AND ativo = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_active_evento_trigger
  AFTER INSERT OR UPDATE OF ativo ON public.sorteio_eventos
  FOR EACH ROW
  WHEN (NEW.ativo = true)
  EXECUTE FUNCTION public.ensure_single_active_evento();

-- 4. Adicionar evento_id nas tabelas existentes
ALTER TABLE public.sorteio_sessoes ADD COLUMN evento_id UUID REFERENCES public.sorteio_eventos(id) ON DELETE SET NULL;
ALTER TABLE public.sorteio_participantes ADD COLUMN evento_id UUID REFERENCES public.sorteio_eventos(id) ON DELETE SET NULL;
ALTER TABLE public.sorteio_ganhadores ADD COLUMN evento_id UUID REFERENCES public.sorteio_eventos(id) ON DELETE SET NULL;
ALTER TABLE public.sorteio_page_views ADD COLUMN evento_id UUID REFERENCES public.sorteio_eventos(id) ON DELETE SET NULL;

-- 5. Criar evento default AGE 2026 e backfill
DO $$
DECLARE
  v_evento_id UUID;
BEGIN
  INSERT INTO public.sorteio_eventos (
    nome, slug, ativo, titulo, subtitulo, descricao, premio_destaque,
    cor_primaria, texto_botao_cta, mostrar_campo_embaixadora
  ) VALUES (
    'AGE 2026', 'age-2026', true,
    'AGE 2026 - Sorteio de Embaixadoras',
    'Participe do nosso sorteio exclusivo',
    'Cadastre-se para concorrer a prêmios incríveis durante o evento AGE 2026.',
    'Prêmios exclusivos a cada hora',
    '#D4AF37', 'Quero participar', true
  ) RETURNING id INTO v_evento_id;

  UPDATE public.sorteio_sessoes SET evento_id = v_evento_id WHERE evento_id IS NULL;
  UPDATE public.sorteio_participantes SET evento_id = v_evento_id WHERE evento_id IS NULL;
  UPDATE public.sorteio_ganhadores SET evento_id = v_evento_id WHERE evento_id IS NULL;
  UPDATE public.sorteio_page_views SET evento_id = v_evento_id WHERE evento_id IS NULL;
END $$;

-- 6. Substituir UNIQUE(email/whatsapp) por UNIQUE(evento_id, email/whatsapp)
ALTER TABLE public.sorteio_participantes DROP CONSTRAINT IF EXISTS sorteio_participantes_email_key;
ALTER TABLE public.sorteio_participantes DROP CONSTRAINT IF EXISTS sorteio_participantes_whatsapp_key;

ALTER TABLE public.sorteio_participantes
  ADD CONSTRAINT sorteio_participantes_evento_email_key UNIQUE (evento_id, email);
ALTER TABLE public.sorteio_participantes
  ADD CONSTRAINT sorteio_participantes_evento_whatsapp_key UNIQUE (evento_id, whatsapp);

-- 7. Índices
CREATE INDEX idx_sorteio_sessoes_evento ON public.sorteio_sessoes(evento_id);
CREATE INDEX idx_sorteio_participantes_evento ON public.sorteio_participantes(evento_id);
CREATE INDEX idx_sorteio_ganhadores_evento ON public.sorteio_ganhadores(evento_id);
CREATE INDEX idx_sorteio_eventos_ativo ON public.sorteio_eventos(ativo) WHERE ativo = true;

-- 8. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('sorteio-banners', 'sorteio-banners', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Sorteio banners publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sorteio-banners');

CREATE POLICY "Admins can upload sorteio banners"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sorteio-banners'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role))
  );

CREATE POLICY "Admins can update sorteio banners"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sorteio-banners'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role))
  );

CREATE POLICY "Admins can delete sorteio banners"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'sorteio-banners'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role))
  );
