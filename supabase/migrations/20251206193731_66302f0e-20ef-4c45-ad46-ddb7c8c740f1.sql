-- Add possui_plano_leitura field to ebd_revistas
ALTER TABLE public.ebd_revistas 
ADD COLUMN IF NOT EXISTS possui_plano_leitura BOOLEAN NOT NULL DEFAULT FALSE;

-- Add plano_leitura_semanal field to ebd_licoes (stores 7 days of reading plan as JSON)
ALTER TABLE public.ebd_licoes 
ADD COLUMN IF NOT EXISTS plano_leitura_semanal JSONB DEFAULT NULL;

-- Create a function to automatically update possui_plano_leitura when all lessons have reading plans
CREATE OR REPLACE FUNCTION public.check_revista_plano_leitura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_licoes INTEGER;
  licoes_com_plano INTEGER;
BEGIN
  -- Only process if revista_id is set
  IF NEW.revista_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Count total lessons for this magazine
  SELECT COUNT(*) INTO total_licoes
  FROM public.ebd_licoes
  WHERE revista_id = NEW.revista_id;

  -- Count lessons with reading plan
  SELECT COUNT(*) INTO licoes_com_plano
  FROM public.ebd_licoes
  WHERE revista_id = NEW.revista_id
    AND plano_leitura_semanal IS NOT NULL
    AND plano_leitura_semanal != 'null'::jsonb
    AND jsonb_array_length(plano_leitura_semanal) = 7;

  -- Update the magazine's possui_plano_leitura field
  UPDATE public.ebd_revistas
  SET possui_plano_leitura = (total_licoes > 0 AND total_licoes = licoes_com_plano),
      updated_at = now()
  WHERE id = NEW.revista_id;

  RETURN NEW;
END;
$$;

-- Create trigger to check reading plan status after lesson insert/update
DROP TRIGGER IF EXISTS check_plano_leitura_on_licao ON public.ebd_licoes;
CREATE TRIGGER check_plano_leitura_on_licao
  AFTER INSERT OR UPDATE OF plano_leitura_semanal ON public.ebd_licoes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_revista_plano_leitura();