-- Add email field to ebd_pedidos table for order notifications
ALTER TABLE public.ebd_pedidos 
ADD COLUMN email_cliente VARCHAR(255);