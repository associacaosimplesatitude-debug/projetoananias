-- Add nav_text_color column to branding_settings
ALTER TABLE branding_settings 
ADD COLUMN nav_text_color text DEFAULT '#ffffff';

-- Update existing row with default value
UPDATE branding_settings 
SET nav_text_color = '#ffffff' 
WHERE id = '00000000-0000-0000-0000-000000000001';