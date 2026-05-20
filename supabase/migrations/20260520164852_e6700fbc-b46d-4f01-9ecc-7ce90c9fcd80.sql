
-- 1. Normalize legacy status values before adding CHECK
UPDATE public.whatsapp_campanha_destinatarios SET status_envio = 'sent'   WHERE status_envio = 'enviado';
UPDATE public.whatsapp_campanha_destinatarios SET status_envio = 'failed' WHERE status_envio = 'erro';

-- 2. Add delivery timestamp columns
ALTER TABLE public.whatsapp_campanha_destinatarios
  ADD COLUMN IF NOT EXISTS entregue_em   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS lido_em       timestamptz NULL,
  ADD COLUMN IF NOT EXISTS falhou_em     timestamptz NULL,
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz NULL;

-- 3. CHECK on status_envio
ALTER TABLE public.whatsapp_campanha_destinatarios
  DROP CONSTRAINT IF EXISTS whatsapp_campanha_destinatarios_status_envio_check;
ALTER TABLE public.whatsapp_campanha_destinatarios
  ADD CONSTRAINT whatsapp_campanha_destinatarios_status_envio_check
  CHECK (status_envio IN ('pendente','sent','delivered','read','failed','cancelado_optout'));

-- 4. Aggregate columns on whatsapp_campanhas
ALTER TABLE public.whatsapp_campanhas
  ADD COLUMN IF NOT EXISTS total_entregues   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_lidos       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_falhas      int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_respondidos int NOT NULL DEFAULT 0;

-- 5. Trigger function: recompute aggregates from destinatarios
CREATE OR REPLACE FUNCTION public.whatsapp_campanha_destinatarios_agregar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campanha uuid := COALESCE(NEW.campanha_id, OLD.campanha_id);
BEGIN
  UPDATE public.whatsapp_campanhas c SET
    total_enviados    = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND status_envio IN ('sent','delivered','read')),
    total_entregues   = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND entregue_em IS NOT NULL),
    total_lidos       = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND lido_em IS NOT NULL),
    total_falhas      = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND status_envio = 'failed'),
    total_respondidos = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND respondido_em IS NOT NULL)
  WHERE c.id = v_campanha;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campanha_destinatarios_agregar ON public.whatsapp_campanha_destinatarios;
CREATE TRIGGER trg_whatsapp_campanha_destinatarios_agregar
AFTER UPDATE OF status_envio, entregue_em, lido_em, falhou_em, respondido_em
ON public.whatsapp_campanha_destinatarios
FOR EACH ROW
EXECUTE FUNCTION public.whatsapp_campanha_destinatarios_agregar();

-- 6. Setting whatsapp_app_secret (vazio até admin preencher)
INSERT INTO public.system_settings (key, value)
VALUES ('whatsapp_app_secret', '')
ON CONFLICT (key) DO NOTHING;
