-- Add unique constraint on bling_order_id for upsert operations
ALTER TABLE bling_marketplace_pedidos 
ADD CONSTRAINT bling_marketplace_pedidos_bling_order_id_key UNIQUE (bling_order_id);