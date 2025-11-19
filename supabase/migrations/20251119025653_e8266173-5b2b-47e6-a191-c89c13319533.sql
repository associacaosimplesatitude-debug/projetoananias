-- Create storage bucket for church documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'church-documents',
  'church-documents',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']
);

-- Create table to track document uploads
CREATE TABLE IF NOT EXISTS public.church_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL,
  sub_task_id TEXT NOT NULL,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on church_documents
ALTER TABLE public.church_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for church_documents
CREATE POLICY "Admins can manage all documents"
  ON public.church_documents
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can view their documents"
  ON public.church_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.churches
      WHERE churches.id = church_documents.church_id
      AND churches.user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners can upload documents"
  ON public.church_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.churches
      WHERE churches.id = church_documents.church_id
      AND churches.user_id = auth.uid()
    )
  );

-- Storage RLS policies
CREATE POLICY "Admins can access all documents"
  ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'church-documents'
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Church owners can view their documents"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.churches WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Church owners can upload their documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'church-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.churches WHERE user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER update_church_documents_updated_at
  BEFORE UPDATE ON public.church_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();