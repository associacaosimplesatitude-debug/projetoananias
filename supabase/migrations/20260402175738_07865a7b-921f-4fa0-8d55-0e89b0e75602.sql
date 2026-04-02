ALTER TABLE revista_licencas_shopify 
ADD CONSTRAINT unique_licenca_shopify 
UNIQUE (shopify_order_id, whatsapp, revista_id);