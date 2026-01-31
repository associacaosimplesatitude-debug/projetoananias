-- Create contracts table
CREATE TABLE public.royalties_contratos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  autor_id UUID NOT NULL REFERENCES public.royalties_autores(id) ON DELETE CASCADE,
  livro_id UUID NOT NULL REFERENCES public.royalties_livros(id) ON DELETE CASCADE,
  pdf_url TEXT,
  data_inicio DATE NOT NULL,
  data_termino DATE NOT NULL,
  termos_contrato TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.royalties_contratos ENABLE ROW LEVEL SECURITY;

-- RLS policies for admins
CREATE POLICY "Admins can view all contracts"
ON public.royalties_contratos
FOR SELECT
USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins can insert contracts"
ON public.royalties_contratos
FOR INSERT
WITH CHECK (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins can update contracts"
ON public.royalties_contratos
FOR UPDATE
USING (public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins can delete contracts"
ON public.royalties_contratos
FOR DELETE
USING (public.has_royalties_access(auth.uid()));

-- Authors can view their own contracts
CREATE POLICY "Authors can view own contracts"
ON public.royalties_contratos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.royalties_autores ra
    WHERE ra.id = royalties_contratos.autor_id
    AND ra.user_id = auth.uid()
  )
);

-- Create storage bucket for contract PDFs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('royalties-contratos', 'royalties-contratos', false);

-- Storage policies
CREATE POLICY "Admins can upload contract PDFs"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'royalties-contratos' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins can view contract PDFs"
ON storage.objects
FOR SELECT
USING (bucket_id = 'royalties-contratos' AND public.has_royalties_access(auth.uid()));

CREATE POLICY "Admins can delete contract PDFs"
ON storage.objects
FOR DELETE
USING (bucket_id = 'royalties-contratos' AND public.has_royalties_access(auth.uid()));

-- Authors can view their own contract PDFs
CREATE POLICY "Authors can view own contract PDFs"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'royalties-contratos' AND
  EXISTS (
    SELECT 1 FROM public.royalties_contratos rc
    JOIN public.royalties_autores ra ON ra.id = rc.autor_id
    WHERE rc.pdf_url LIKE '%' || name || '%'
    AND ra.user_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_royalties_contratos_updated_at
BEFORE UPDATE ON public.royalties_contratos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trigger
CREATE TRIGGER royalties_contratos_audit
AFTER INSERT OR UPDATE OR DELETE ON public.royalties_contratos
FOR EACH ROW EXECUTE FUNCTION public.royalties_audit_trigger_fn();