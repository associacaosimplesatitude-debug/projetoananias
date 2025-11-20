-- Create bank_accounts table
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  agency TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('Corrente', 'Poupança')),
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  initial_balance_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Church owners can manage their bank accounts"
ON public.bank_accounts
FOR ALL
USING (church_id IN (
  SELECT id FROM churches WHERE user_id = auth.uid()
))
WITH CHECK (church_id IN (
  SELECT id FROM churches WHERE user_id = auth.uid()
));

CREATE POLICY "Members with financial permission can view bank accounts"
ON public.bank_accounts
FOR SELECT
USING (has_church_permission(auth.uid(), church_id, 'view_financial'));

CREATE POLICY "Admins can manage all bank accounts"
ON public.bank_accounts
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bank_accounts_updated_at
BEFORE UPDATE ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add payment_account field to financial_entries
ALTER TABLE public.financial_entries
ADD COLUMN IF NOT EXISTS payment_account TEXT DEFAULT 'Caixa Geral';

-- Add payment_account field to bills_to_pay
ALTER TABLE public.bills_to_pay
ADD COLUMN IF NOT EXISTS payment_account TEXT DEFAULT 'Caixa Geral';