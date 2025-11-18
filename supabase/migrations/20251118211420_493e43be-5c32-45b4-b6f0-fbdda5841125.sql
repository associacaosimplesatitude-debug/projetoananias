-- Create table for board mandates
CREATE TABLE public.board_mandates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.board_mandates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all mandates"
ON public.board_mandates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can view their mandates"
ON public.board_mandates
FOR SELECT
USING (
  church_id IN (
    SELECT id FROM public.churches
    WHERE user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_board_mandates_updated_at
BEFORE UPDATE ON public.board_mandates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();