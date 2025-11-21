-- Add estado_civil field to church_members table
ALTER TABLE public.church_members 
ADD COLUMN IF NOT EXISTS estado_civil text;