-- Fix function search path for calculate_next_purchase_date
CREATE OR REPLACE FUNCTION public.calculate_next_purchase_date(start_date DATE)
RETURNS DATE
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT start_date + INTERVAL '13 weeks'
$$;