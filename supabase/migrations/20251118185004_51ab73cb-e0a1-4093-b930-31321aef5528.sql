-- Create enum for permission types
CREATE TYPE public.church_permission AS ENUM (
  'view_financial',
  'edit_financial', 
  'approve_expenses',
  'manage_members',
  'view_reports',
  'edit_church_info'
);

-- Create church_member_permissions table
CREATE TABLE public.church_member_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission church_permission NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(church_id, user_id, permission)
);

-- Enable RLS
ALTER TABLE public.church_member_permissions ENABLE ROW LEVEL SECURITY;

-- Create index for better performance
CREATE INDEX idx_church_member_permissions_user ON public.church_member_permissions(user_id);
CREATE INDEX idx_church_member_permissions_church ON public.church_member_permissions(church_id);

-- Security definer function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_church_permission(
  _user_id UUID,
  _church_id UUID,
  _permission church_permission
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_member_permissions
    WHERE user_id = _user_id
      AND church_id = _church_id
      AND permission = _permission
  )
$$;

-- RLS Policies for church_member_permissions
-- Church owners can manage all permissions for their church
CREATE POLICY "Church owners can manage member permissions"
ON public.church_member_permissions
FOR ALL
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Admins can manage all permissions
CREATE POLICY "Admins can manage all permissions"
ON public.church_member_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own permissions
CREATE POLICY "Users can view their own permissions"
ON public.church_member_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_church_member_permissions_updated_at
  BEFORE UPDATE ON public.church_member_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();