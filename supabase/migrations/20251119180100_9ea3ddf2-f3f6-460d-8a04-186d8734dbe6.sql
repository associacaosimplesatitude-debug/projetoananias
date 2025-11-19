-- Add scheduled_datetime column to church_stage_progress table for storing appointment dates
ALTER TABLE church_stage_progress 
ADD COLUMN scheduled_datetime timestamp with time zone;