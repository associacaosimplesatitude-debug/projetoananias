-- Add payment_link column to church_stage_progress table
ALTER TABLE church_stage_progress
ADD COLUMN payment_link TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN church_stage_progress.payment_link IS 'Payment link provided by admin for payment tasks';