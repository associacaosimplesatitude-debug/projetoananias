-- Create financial_entries table for church income tracking
CREATE TABLE IF NOT EXISTS public.financial_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora time,
  tipo text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  membro_id text,
  membro_nome text,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create financial_expenses table for church expense tracking
CREATE TABLE IF NOT EXISTS public.financial_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  data date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  categoria_main text NOT NULL,
  categoria_sub text NOT NULL,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_entries
CREATE POLICY "Church owners can view their entries"
  ON public.financial_entries FOR SELECT
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can insert their entries"
  ON public.financial_entries FOR INSERT
  WITH CHECK (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can update their entries"
  ON public.financial_entries FOR UPDATE
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can delete their entries"
  ON public.financial_entries FOR DELETE
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all entries"
  ON public.financial_entries FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members with permission can view entries"
  ON public.financial_entries FOR SELECT
  USING (has_church_permission(auth.uid(), church_id, 'view_financial'::church_permission));

-- RLS Policies for financial_expenses
CREATE POLICY "Church owners can view their expenses"
  ON public.financial_expenses FOR SELECT
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can insert their expenses"
  ON public.financial_expenses FOR INSERT
  WITH CHECK (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can update their expenses"
  ON public.financial_expenses FOR UPDATE
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Church owners can delete their expenses"
  ON public.financial_expenses FOR DELETE
  USING (church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can manage all expenses"
  ON public.financial_expenses FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Members with permission can view expenses"
  ON public.financial_expenses FOR SELECT
  USING (has_church_permission(auth.uid(), church_id, 'view_financial'::church_permission));

-- Create indexes for better performance
CREATE INDEX idx_financial_entries_church_id ON public.financial_entries(church_id);
CREATE INDEX idx_financial_entries_data ON public.financial_entries(data);
CREATE INDEX idx_financial_expenses_church_id ON public.financial_expenses(church_id);
CREATE INDEX idx_financial_expenses_data ON public.financial_expenses(data);

-- Create trigger for updated_at
CREATE TRIGGER update_financial_entries_updated_at
  BEFORE UPDATE ON public.financial_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_financial_expenses_updated_at
  BEFORE UPDATE ON public.financial_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();