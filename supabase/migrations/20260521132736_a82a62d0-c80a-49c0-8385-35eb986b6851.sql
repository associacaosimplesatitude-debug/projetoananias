UPDATE public.whatsapp_campanha_destinatarios
SET status_envio = 'pendente',
    erro_codigo = NULL,
    erro_mensagem = NULL,
    falhou_em = NULL,
    meta_message_id = NULL,
    enviado_em = NULL
WHERE campanha_id = 'a837230e-9ab8-4e53-9863-7ec66d66ff94'
  AND status_envio = 'failed';

UPDATE public.whatsapp_campanhas
SET status = 'agendada',
    agendada_para = now(),
    total_enviados = 0,
    total_falhas = 0
WHERE id = 'a837230e-9ab8-4e53-9863-7ec66d66ff94';