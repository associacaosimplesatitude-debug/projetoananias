-- Adicionar campo possui_quiz_mestre na tabela ebd_revistas
ALTER TABLE public.ebd_revistas 
ADD COLUMN IF NOT EXISTS possui_quiz_mestre boolean NOT NULL DEFAULT false;

-- Criar tabela para questões do quiz mestre (vinculadas à lição da revista)
CREATE TABLE public.ebd_quiz_mestre_questoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  licao_id UUID NOT NULL REFERENCES public.ebd_licoes(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL CHECK (ordem >= 1 AND ordem <= 10),
  pergunta TEXT NOT NULL,
  opcao_a TEXT NOT NULL,
  opcao_b TEXT NOT NULL,
  opcao_c TEXT NOT NULL,
  resposta_correta CHAR(1) NOT NULL CHECK (resposta_correta IN ('A', 'B', 'C')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(licao_id, ordem)
);

-- Enable RLS
ALTER TABLE public.ebd_quiz_mestre_questoes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all quiz_mestre_questoes"
ON public.ebd_quiz_mestre_questoes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view quiz_mestre_questoes"
ON public.ebd_quiz_mestre_questoes
FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ebd_quiz_mestre_questoes_updated_at
BEFORE UPDATE ON public.ebd_quiz_mestre_questoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para verificar e atualizar possui_quiz_mestre
CREATE OR REPLACE FUNCTION public.check_quiz_mestre_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_revista_id UUID;
  v_total_licoes INTEGER;
  v_licoes_completas INTEGER;
BEGIN
  -- Obter a revista_id da lição
  SELECT revista_id INTO v_revista_id 
  FROM public.ebd_licoes 
  WHERE id = COALESCE(NEW.licao_id, OLD.licao_id);
  
  IF v_revista_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Contar total de lições da revista
  SELECT COUNT(*) INTO v_total_licoes
  FROM public.ebd_licoes
  WHERE revista_id = v_revista_id;
  
  -- Contar lições com 10 questões cadastradas
  SELECT COUNT(DISTINCT l.id) INTO v_licoes_completas
  FROM public.ebd_licoes l
  WHERE l.revista_id = v_revista_id
  AND (SELECT COUNT(*) FROM public.ebd_quiz_mestre_questoes q WHERE q.licao_id = l.id) = 10;
  
  -- Atualizar possui_quiz_mestre se todas as lições estiverem completas
  UPDATE public.ebd_revistas
  SET possui_quiz_mestre = (v_licoes_completas = v_total_licoes AND v_total_licoes > 0)
  WHERE id = v_revista_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para verificar conclusão após INSERT, UPDATE ou DELETE
CREATE TRIGGER check_quiz_mestre_completion_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.ebd_quiz_mestre_questoes
FOR EACH ROW
EXECUTE FUNCTION public.check_quiz_mestre_completion();