-- Adicionar coluna de status logístico na tabela ebd_pedidos
ALTER TABLE ebd_pedidos 
ADD COLUMN IF NOT EXISTS status_logistico TEXT DEFAULT 'AGUARDANDO_ENVIO' CHECK (status_logistico IN ('AGUARDANDO_ENVIO', 'ENVIADO', 'ENTREGUE'));

-- Adicionar coluna para armazenar mercadopago_payment_id para rastreamento
ALTER TABLE ebd_pedidos 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN ebd_pedidos.status_logistico IS 'Status de logística da entrega: AGUARDANDO_ENVIO, ENVIADO, ENTREGUE';
COMMENT ON COLUMN ebd_pedidos.payment_status IS 'Status do pagamento no Mercado Pago';