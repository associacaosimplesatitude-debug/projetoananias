-- Create lancamentos_contabeis table for double-entry bookkeeping
CREATE TABLE public.lancamentos_contabeis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id),
  data DATE NOT NULL,
  historico TEXT NOT NULL,
  conta_debito TEXT NOT NULL,
  conta_credito TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  documento TEXT,
  entry_id UUID REFERENCES public.financial_entries(id),
  expense_id UUID REFERENCES public.bills_to_pay(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.lancamentos_contabeis ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all lancamentos"
ON public.lancamentos_contabeis
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their lancamentos"
ON public.lancamentos_contabeis
FOR ALL
USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

CREATE POLICY "Members with permission can view lancamentos"
ON public.lancamentos_contabeis
FOR SELECT
USING (has_church_permission(auth.uid(), church_id, 'view_financial'::church_permission));

-- Create indexes
CREATE INDEX idx_lancamentos_church_id ON public.lancamentos_contabeis(church_id);
CREATE INDEX idx_lancamentos_data ON public.lancamentos_contabeis(data);
CREATE INDEX idx_lancamentos_conta_debito ON public.lancamentos_contabeis(conta_debito);
CREATE INDEX idx_lancamentos_conta_credito ON public.lancamentos_contabeis(conta_credito);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lancamentos_contabeis_updated_at
BEFORE UPDATE ON public.lancamentos_contabeis
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();