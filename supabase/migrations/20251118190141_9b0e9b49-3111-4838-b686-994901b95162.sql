-- Add payment type fields to accounts_payable table
ALTER TABLE public.accounts_payable
ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('unica', 'parcelada', 'recorrente')) DEFAULT 'unica',
ADD COLUMN IF NOT EXISTS installments INTEGER,
ADD COLUMN IF NOT EXISTS current_installment INTEGER DEFAULT 1;