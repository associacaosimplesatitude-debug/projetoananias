ALTER TABLE public.ebd_retencao_contatos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ebd_retencao_contatos;