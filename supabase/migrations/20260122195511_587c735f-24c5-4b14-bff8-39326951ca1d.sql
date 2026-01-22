-- Remover a FK constraint que está causando o erro 23503
-- A tabela ebd_quizzes.church_id pode referenciar ebd_clientes.id OU churches.id
ALTER TABLE public.ebd_quizzes DROP CONSTRAINT IF EXISTS ebd_quizzes_church_id_fkey;

-- Criar função de validação que verifica se church_id existe em ebd_clientes OU churches
CREATE OR REPLACE FUNCTION public.validate_ebd_church_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se church_id existe em ebd_clientes OU churches
  IF NOT EXISTS (
    SELECT 1 FROM public.ebd_clientes WHERE id = NEW.church_id
    UNION ALL
    SELECT 1 FROM public.churches WHERE id = NEW.church_id
  ) THEN
    RAISE EXCEPTION 'church_id inválido: % não existe em ebd_clientes nem em churches', NEW.church_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para validar antes de INSERT/UPDATE
DROP TRIGGER IF EXISTS trg_validate_ebd_quizzes_church_id ON public.ebd_quizzes;
CREATE TRIGGER trg_validate_ebd_quizzes_church_id
  BEFORE INSERT OR UPDATE ON public.ebd_quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ebd_church_id();