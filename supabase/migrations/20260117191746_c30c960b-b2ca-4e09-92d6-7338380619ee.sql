-- Atualizar constraint para incluir 'online' como origem válida
ALTER TABLE vendedor_propostas_parcelas 
DROP CONSTRAINT vendedor_propostas_parcelas_origem_check;

ALTER TABLE vendedor_propostas_parcelas 
ADD CONSTRAINT vendedor_propostas_parcelas_origem_check 
CHECK (origem = ANY (ARRAY['faturado'::text, 'mercadopago'::text, 'online'::text]));