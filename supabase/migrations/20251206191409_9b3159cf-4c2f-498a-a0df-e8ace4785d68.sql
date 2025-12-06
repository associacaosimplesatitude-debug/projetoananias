-- Function to update student level based on points
CREATE OR REPLACE FUNCTION public.update_aluno_nivel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novo_nivel VARCHAR(50);
BEGIN
  -- Determine level based on points
  IF NEW.pontos_totais >= 1001 THEN
    novo_nivel := 'Safira';
  ELSIF NEW.pontos_totais >= 501 THEN
    novo_nivel := 'Prata';
  ELSE
    novo_nivel := 'Bronze';
  END IF;
  
  -- Update level if different
  IF NEW.nivel IS DISTINCT FROM novo_nivel THEN
    NEW.nivel := novo_nivel;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to update level when points change
DROP TRIGGER IF EXISTS trigger_update_aluno_nivel ON public.ebd_alunos;
CREATE TRIGGER trigger_update_aluno_nivel
  BEFORE UPDATE OF pontos_totais ON public.ebd_alunos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_aluno_nivel();

-- Function to add points to student
CREATE OR REPLACE FUNCTION public.adicionar_pontos_aluno(
  p_aluno_id UUID,
  p_pontos INTEGER,
  p_motivo TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  novos_pontos INTEGER;
BEGIN
  UPDATE public.ebd_alunos
  SET pontos_totais = pontos_totais + p_pontos,
      updated_at = now()
  WHERE id = p_aluno_id
  RETURNING pontos_totais INTO novos_pontos;
  
  RETURN novos_pontos;
END;
$$;

-- Function to handle attendance points (presença)
CREATE OR REPLACE FUNCTION public.handle_frequencia_pontos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first_presence BOOLEAN;
  pontos_ganhos INTEGER := 0;
  presencas_anteriores INTEGER;
  ultima_data_presente DATE;
  dias_entre_aulas INTEGER;
BEGIN
  -- Only process if marked as present
  IF NEW.presente = true THEN
    -- Check if this is the first presence ever
    SELECT COUNT(*) INTO presencas_anteriores
    FROM public.ebd_frequencia
    WHERE aluno_id = NEW.aluno_id
      AND presente = true
      AND id != NEW.id;
    
    is_first_presence := presencas_anteriores = 0;
    
    -- Add points for presence (+50)
    pontos_ganhos := 50;
    
    -- Add bonus for first presence (+100)
    IF is_first_presence THEN
      pontos_ganhos := pontos_ganhos + 100;
    END IF;
    
    -- Update points
    UPDATE public.ebd_alunos
    SET pontos_totais = pontos_totais + pontos_ganhos,
        updated_at = now()
    WHERE id = NEW.aluno_id;
    
    -- Update sequential attendance (aulas_seguidas)
    -- Get the last presence date before this one
    SELECT MAX(data) INTO ultima_data_presente
    FROM public.ebd_frequencia
    WHERE aluno_id = NEW.aluno_id
      AND presente = true
      AND data < NEW.data
      AND id != NEW.id;
    
    IF ultima_data_presente IS NOT NULL THEN
      -- Calculate days between attendances
      dias_entre_aulas := NEW.data - ultima_data_presente;
      
      -- If within 14 days (2 weeks max between classes), increment streak
      IF dias_entre_aulas <= 14 THEN
        UPDATE public.ebd_alunos
        SET aulas_seguidas = aulas_seguidas + 1,
            updated_at = now()
        WHERE id = NEW.aluno_id;
      ELSE
        -- Reset streak if gap too large
        UPDATE public.ebd_alunos
        SET aulas_seguidas = 1,
            updated_at = now()
        WHERE id = NEW.aluno_id;
      END IF;
    ELSE
      -- First presence, start streak at 1
      UPDATE public.ebd_alunos
      SET aulas_seguidas = 1,
          updated_at = now()
      WHERE id = NEW.aluno_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for attendance points
DROP TRIGGER IF EXISTS trigger_frequencia_pontos ON public.ebd_frequencia;
CREATE TRIGGER trigger_frequencia_pontos
  AFTER INSERT ON public.ebd_frequencia
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_frequencia_pontos();

-- Function to handle daily reading points
CREATE OR REPLACE FUNCTION public.handle_leitura_pontos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add points when reading is marked as complete (+5)
  IF NEW.status = 'completo' AND (OLD IS NULL OR OLD.status != 'completo') THEN
    UPDATE public.ebd_alunos
    SET pontos_totais = pontos_totais + 5,
        updated_at = now()
    WHERE id = NEW.aluno_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for reading points (insert and update)
DROP TRIGGER IF EXISTS trigger_leitura_pontos_insert ON public.ebd_leituras;
CREATE TRIGGER trigger_leitura_pontos_insert
  AFTER INSERT ON public.ebd_leituras
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leitura_pontos();

DROP TRIGGER IF EXISTS trigger_leitura_pontos_update ON public.ebd_leituras;
CREATE TRIGGER trigger_leitura_pontos_update
  AFTER UPDATE OF status ON public.ebd_leituras
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_leitura_pontos();

-- Function to handle devotional points
CREATE OR REPLACE FUNCTION public.handle_devocional_pontos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add points for completing devotional (+10)
  UPDATE public.ebd_alunos
  SET pontos_totais = pontos_totais + 10,
      updated_at = now()
  WHERE id = NEW.aluno_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for devotional points
DROP TRIGGER IF EXISTS trigger_devocional_pontos ON public.ebd_devocional_registro;
CREATE TRIGGER trigger_devocional_pontos
  AFTER INSERT ON public.ebd_devocional_registro
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_devocional_pontos();

-- Create table for manual participation points (Professor launches)
CREATE TABLE IF NOT EXISTS public.ebd_pontuacao_manual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  turma_id UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  church_id UUID NOT NULL,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  pontos INTEGER NOT NULL DEFAULT 20,
  motivo TEXT NOT NULL DEFAULT 'Participação em Aula',
  registrado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebd_pontuacao_manual ENABLE ROW LEVEL SECURITY;

-- RLS policies for manual points
CREATE POLICY "Admins can manage all pontuacao_manual" ON public.ebd_pontuacao_manual
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their pontuacao_manual" ON public.ebd_pontuacao_manual
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

-- Function to handle manual participation points
CREATE OR REPLACE FUNCTION public.handle_pontuacao_manual()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add manual points to student
  UPDATE public.ebd_alunos
  SET pontos_totais = pontos_totais + NEW.pontos,
      updated_at = now()
  WHERE id = NEW.aluno_id;
  
  RETURN NEW;
END;
$$;

-- Trigger for manual points
DROP TRIGGER IF EXISTS trigger_pontuacao_manual ON public.ebd_pontuacao_manual;
CREATE TRIGGER trigger_pontuacao_manual
  AFTER INSERT ON public.ebd_pontuacao_manual
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pontuacao_manual();