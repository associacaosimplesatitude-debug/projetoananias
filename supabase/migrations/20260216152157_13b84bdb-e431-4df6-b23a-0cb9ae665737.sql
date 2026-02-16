
-- Trigger: quando um cliente é marcado como is_pos_venda_ecommerce, 
-- cria automaticamente um registro no funil de tracking
CREATE OR REPLACE FUNCTION public.handle_funil_posv_new_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Apenas quando is_pos_venda_ecommerce muda de false para true
  IF NEW.is_pos_venda_ecommerce = true 
     AND (OLD IS NULL OR OLD.is_pos_venda_ecommerce = false) THEN
    
    -- Inserir no tracking se não existir
    INSERT INTO public.funil_posv_tracking (cliente_id, fase_atual)
    VALUES (NEW.id, 1)
    ON CONFLICT (cliente_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_funil_posv_new_client
AFTER INSERT OR UPDATE OF is_pos_venda_ecommerce ON public.ebd_clientes
FOR EACH ROW
EXECUTE FUNCTION public.handle_funil_posv_new_client();

-- Trigger: quando ultimo_login é preenchido pela primeira vez,
-- dispara a atualização de fase (detectado pelo cron na próxima execução)
-- Não precisa de trigger separado pois o cron já verifica isso.

-- Trigger: quando onboarding_concluido muda para true,
-- mesma lógica - o cron detecta automaticamente.
