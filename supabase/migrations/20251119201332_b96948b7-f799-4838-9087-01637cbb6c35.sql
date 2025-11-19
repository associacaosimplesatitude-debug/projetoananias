-- Add process_status column to churches table
ALTER TABLE public.churches 
ADD COLUMN process_status text NOT NULL DEFAULT 'in_progress';

COMMENT ON COLUMN public.churches.process_status IS 'Status do processo de abertura: in_progress, completed';