-- Add payment_type, installments, and current_installment to accounts_receivable
ALTER TABLE accounts_receivable 
ADD COLUMN payment_type text DEFAULT 'unica',
ADD COLUMN installments integer,
ADD COLUMN current_installment integer DEFAULT 1;