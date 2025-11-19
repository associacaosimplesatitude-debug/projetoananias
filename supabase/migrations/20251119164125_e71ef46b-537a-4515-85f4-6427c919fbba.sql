-- Add rejection_reason column to church_stage_progress table
ALTER TABLE public.church_stage_progress
ADD COLUMN rejection_reason text;