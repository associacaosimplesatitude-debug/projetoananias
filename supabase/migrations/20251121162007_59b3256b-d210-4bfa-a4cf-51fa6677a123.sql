-- Alterar valor padrão de payment_account em financial_entries
ALTER TABLE financial_entries 
ALTER COLUMN payment_account 
SET DEFAULT 'Caixa Geral (Dinheiro)'::text;

-- Alterar valor padrão de payment_account em bills_to_pay
ALTER TABLE bills_to_pay 
ALTER COLUMN payment_account 
SET DEFAULT 'Caixa Geral (Dinheiro)'::text;

-- Atualizar registros existentes que ainda usam o nome antigo
UPDATE financial_entries 
SET payment_account = 'Caixa Geral (Dinheiro)' 
WHERE payment_account = 'Caixa Geral';

UPDATE bills_to_pay 
SET payment_account = 'Caixa Geral (Dinheiro)' 
WHERE payment_account = 'Caixa Geral';