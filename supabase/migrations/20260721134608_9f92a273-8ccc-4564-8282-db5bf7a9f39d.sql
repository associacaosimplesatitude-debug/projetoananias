
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS botao_url_destino text DEFAULT 'https://centralgospel.com.br';

CREATE OR REPLACE FUNCTION public.whatsapp_campanha_destinatarios_agregar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_campanha uuid := COALESCE(NEW.campanha_id, OLD.campanha_id);
BEGIN
  UPDATE public.whatsapp_campanhas c SET
    total_enviados    = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND status_envio IN ('sent','delivered','read')),
    total_entregues   = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND entregue_em IS NOT NULL),
    total_lidos       = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND lido_em IS NOT NULL),
    total_falhas      = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND status_envio = 'failed'),
    total_respondidos = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND respondido_em IS NOT NULL),
    total_link_clicks = (SELECT count(*) FROM public.whatsapp_campanha_destinatarios WHERE campanha_id = v_campanha AND visitou_link = true)
  WHERE c.id = v_campanha;
  RETURN NEW;
END;
$function$;
