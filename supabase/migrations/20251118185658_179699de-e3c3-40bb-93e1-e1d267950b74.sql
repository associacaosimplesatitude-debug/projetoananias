-- Add new fields to churches table
ALTER TABLE public.churches
ADD COLUMN IF NOT EXISTS pastor_name TEXT,
ADD COLUMN IF NOT EXISTS pastor_rg TEXT,
ADD COLUMN IF NOT EXISTS pastor_cpf TEXT,
ADD COLUMN IF NOT EXISTS pastor_whatsapp TEXT,
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC DEFAULT 199.90,
ADD COLUMN IF NOT EXISTS payment_due_day INTEGER CHECK (payment_due_day IN (5, 10, 15, 20, 25, 30));