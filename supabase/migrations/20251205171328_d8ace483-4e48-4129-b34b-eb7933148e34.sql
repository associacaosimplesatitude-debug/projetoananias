-- Create table to track banner dismissals for EBD superintendents
CREATE TABLE public.ebd_banner_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trimester_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ebd_banner_dismissals ENABLE ROW LEVEL SECURITY;

-- Users can view their own dismissals
CREATE POLICY "Users can view their own dismissals"
ON public.ebd_banner_dismissals
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own dismissals
CREATE POLICY "Users can insert their own dismissals"
ON public.ebd_banner_dismissals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can manage all dismissals
CREATE POLICY "Admins can manage all dismissals"
ON public.ebd_banner_dismissals
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_ebd_banner_dismissals_user_church ON public.ebd_banner_dismissals(user_id, church_id, trimester_start);