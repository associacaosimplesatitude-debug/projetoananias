-- Criar tabela de revistas EBD
CREATE TABLE public.ebd_revistas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  faixa_etaria_alvo TEXT NOT NULL,
  sinopse TEXT,
  autor TEXT,
  imagem_url TEXT,
  num_licoes INTEGER NOT NULL DEFAULT 13,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar revista_id à tabela de lições existente
ALTER TABLE public.ebd_licoes 
ADD COLUMN IF NOT EXISTS revista_id UUID REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS numero_licao INTEGER;

-- Atualizar índice para lições
CREATE INDEX IF NOT EXISTS idx_ebd_licoes_revista ON public.ebd_licoes(revista_id);

-- Criar tabela de planejamento escolar
CREATE TABLE public.ebd_planejamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL,
  revista_id UUID NOT NULL REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
  data_inicio DATE NOT NULL,
  dia_semana TEXT NOT NULL,
  data_termino DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar índice para planejamento
CREATE INDEX IF NOT EXISTS idx_ebd_planejamento_church ON public.ebd_planejamento(church_id);
CREATE INDEX IF NOT EXISTS idx_ebd_planejamento_revista ON public.ebd_planejamento(revista_id);

-- Habilitar RLS
ALTER TABLE public.ebd_revistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_planejamento ENABLE ROW LEVEL SECURITY;

-- Políticas para revistas (todos podem ver, só admin pode gerenciar)
CREATE POLICY "Todos podem visualizar revistas"
  ON public.ebd_revistas FOR SELECT
  USING (true);

CREATE POLICY "Admins podem gerenciar revistas"
  ON public.ebd_revistas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para planejamento
CREATE POLICY "Admins podem gerenciar todos planejamentos"
  ON public.ebd_planejamento FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners podem gerenciar seus planejamentos"
  ON public.ebd_planejamento FOR ALL
  USING (
    church_id IN (
      SELECT id FROM churches WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    church_id IN (
      SELECT id FROM churches WHERE user_id = auth.uid()
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ebd_revistas_updated_at
  BEFORE UPDATE ON public.ebd_revistas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ebd_planejamento_updated_at
  BEFORE UPDATE ON public.ebd_planejamento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();