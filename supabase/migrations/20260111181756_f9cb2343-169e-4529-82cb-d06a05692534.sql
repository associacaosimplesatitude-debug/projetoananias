-- Adicionar colunas na tabela ebd_pedidos para suportar pagamento na loja
ALTER TABLE ebd_pedidos 
ADD COLUMN IF NOT EXISTS forma_pagamento_loja TEXT,
ADD COLUMN IF NOT EXISTS bandeira_cartao TEXT,
ADD COLUMN IF NOT EXISTS parcelas_cartao INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS deposito_origem TEXT DEFAULT 'matriz';

-- Comentários
COMMENT ON COLUMN ebd_pedidos.forma_pagamento_loja IS 
  'Forma de pagamento para vendas na loja: pix, dinheiro, cartao_debito, cartao_credito';
COMMENT ON COLUMN ebd_pedidos.bandeira_cartao IS 
  'Bandeira do cartão: visa, mastercard, elo, amex, hipercard, outra';
COMMENT ON COLUMN ebd_pedidos.parcelas_cartao IS 
  'Quantidade de parcelas para cartão crédito (1-10)';
COMMENT ON COLUMN ebd_pedidos.deposito_origem IS 
  'Origem do estoque: local (Penha), matriz (RJ), pernambuco (PE)';