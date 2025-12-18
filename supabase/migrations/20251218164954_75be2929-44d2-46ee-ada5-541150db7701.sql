-- Add column to store which payment terms the seller selected for B2B proposals
ALTER TABLE public.vendedor_propostas 
ADD COLUMN IF NOT EXISTS prazos_disponiveis text[] DEFAULT ARRAY['30', '60', '90'];