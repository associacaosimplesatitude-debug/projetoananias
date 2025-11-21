-- Add avatar_url column to church_members table
ALTER TABLE public.church_members 
ADD COLUMN avatar_url TEXT;

COMMENT ON COLUMN public.church_members.avatar_url IS 'URL to the member profile photo stored in Supabase storage';