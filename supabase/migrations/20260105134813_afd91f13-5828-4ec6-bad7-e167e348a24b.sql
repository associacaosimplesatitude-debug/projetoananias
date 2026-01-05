-- Add unique constraint for cliente_id and categoria combination
ALTER TABLE public.ebd_descontos_categoria_representante 
ADD CONSTRAINT ebd_descontos_categoria_representante_cliente_categoria_unique 
UNIQUE (cliente_id, categoria);