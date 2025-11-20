-- Create church_members table
CREATE TABLE public.church_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  endereco TEXT NOT NULL,
  data_aniversario DATE NOT NULL,
  sexo TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  cargo TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.church_members ENABLE ROW LEVEL SECURITY;

-- Church owners can view their members
CREATE POLICY "Church owners can view their members"
ON public.church_members
FOR SELECT
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Church owners can insert their members
CREATE POLICY "Church owners can insert their members"
ON public.church_members
FOR INSERT
WITH CHECK (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Church owners can update their members
CREATE POLICY "Church owners can update their members"
ON public.church_members
FOR UPDATE
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Church owners can delete their members
CREATE POLICY "Church owners can delete their members"
ON public.church_members
FOR DELETE
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Members with permission can view members
CREATE POLICY "Members with permission can view members"
ON public.church_members
FOR SELECT
USING (
  has_church_permission(auth.uid(), church_id, 'manage_members'::church_permission)
);

-- Admins can manage all members
CREATE POLICY "Admins can manage all members"
ON public.church_members
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_church_members_updated_at
BEFORE UPDATE ON public.church_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();