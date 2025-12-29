-- Corrigir a função para ter search_path definido
CREATE OR REPLACE FUNCTION public.update_ebd_onboarding_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;