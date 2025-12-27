-- Adiciona coluna customer_document para armazenar CPF/CNPJ vindo da Shopify
ALTER TABLE public.ebd_shopify_pedidos 
ADD COLUMN IF NOT EXISTS customer_document text;