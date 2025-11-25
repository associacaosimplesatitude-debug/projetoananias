-- Create table for age ranges
CREATE TABLE public.ebd_faixas_etarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome_faixa TEXT NOT NULL,
  idade_min INTEGER NOT NULL,
  idade_max INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  CONSTRAINT valid_age_range CHECK (idade_min >= 0 AND idade_max >= idade_min)
);

-- Enable RLS
ALTER TABLE public.ebd_faixas_etarias ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage all faixas_etarias"
ON public.ebd_faixas_etarias
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their faixas_etarias"
ON public.ebd_faixas_etarias
FOR ALL
TO authenticated
USING (
  church_id IN (
    SELECT id FROM churches WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  church_id IN (
    SELECT id FROM churches WHERE user_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX idx_ebd_faixas_etarias_church_id ON public.ebd_faixas_etarias(church_id);

-- Create trigger for updated_at
CREATE TRIGGER update_ebd_faixas_etarias_updated_at
BEFORE UPDATE ON public.ebd_faixas_etarias
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();