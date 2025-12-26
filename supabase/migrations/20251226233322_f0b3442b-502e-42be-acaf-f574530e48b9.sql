-- Drop existing policy and recreate with consistent method
DROP POLICY IF EXISTS "Vendedores podem ver suas propostas" ON public.vendedor_propostas;

-- Recreate with get_vendedor_id_by_email helper (same pattern as other tables)
CREATE POLICY "Vendedores podem ver suas propostas"
  ON public.vendedor_propostas
  FOR SELECT
  USING (
    vendedor_id = get_vendedor_id_by_email(get_auth_email())
  );