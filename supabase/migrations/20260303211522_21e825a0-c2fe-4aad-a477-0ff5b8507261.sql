ALTER TABLE whatsapp_campanha_destinatarios 
  ADD COLUMN IF NOT EXISTS data_pedido text,
  ADD COLUMN IF NOT EXISTS produtos_pedido text,
  ADD COLUMN IF NOT EXISTS valor_pedido text;