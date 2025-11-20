-- Criar tabela de despesas recorrentes
CREATE TABLE public.recurring_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category_main TEXT NOT NULL,
  category_sub TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de contas a pagar
CREATE TABLE public.bills_to_pay (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  category_main TEXT NOT NULL,
  category_sub TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  paid_date DATE,
  paid_amount NUMERIC,
  receipt_path TEXT,
  recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE SET NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills_to_pay ENABLE ROW LEVEL SECURITY;

-- Políticas para recurring_expenses
CREATE POLICY "Church owners can manage their recurring expenses"
  ON public.recurring_expenses
  FOR ALL
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ))
  WITH CHECK (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all recurring expenses"
  ON public.recurring_expenses
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Políticas para bills_to_pay
CREATE POLICY "Church owners can manage their bills"
  ON public.bills_to_pay
  FOR ALL
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ))
  WITH CHECK (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all bills"
  ON public.bills_to_pay
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members with financial permission can view bills"
  ON public.bills_to_pay
  FOR SELECT
  USING (has_church_permission(auth.uid(), church_id, 'view_financial'::church_permission));

-- Triggers para updated_at
CREATE TRIGGER update_recurring_expenses_updated_at
  BEFORE UPDATE ON public.recurring_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bills_to_pay_updated_at
  BEFORE UPDATE ON public.bills_to_pay
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar bucket de storage para comprovantes
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para comprovantes
CREATE POLICY "Church owners can upload receipts"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners can view their receipts"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners can delete their receipts"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'payment-receipts' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all receipts"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'payment-receipts' AND
    has_role(auth.uid(), 'admin'::app_role)
  );