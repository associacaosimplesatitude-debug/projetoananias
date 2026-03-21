
-- Drop existing FK constraints and recreate with ON DELETE CASCADE
ALTER TABLE public.embaixadoras_cliques
  DROP CONSTRAINT IF EXISTS embaixadoras_cliques_embaixadora_id_fkey,
  ADD CONSTRAINT embaixadoras_cliques_embaixadora_id_fkey
    FOREIGN KEY (embaixadora_id) REFERENCES public.embaixadoras(id) ON DELETE CASCADE;

ALTER TABLE public.embaixadoras_vendas
  DROP CONSTRAINT IF EXISTS embaixadoras_vendas_embaixadora_id_fkey,
  ADD CONSTRAINT embaixadoras_vendas_embaixadora_id_fkey
    FOREIGN KEY (embaixadora_id) REFERENCES public.embaixadoras(id) ON DELETE CASCADE;

-- Add DELETE RLS policies for admin/gerente_ebd/gerente_sorteio
CREATE POLICY "Admin can delete embaixadoras"
  ON public.embaixadoras
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente_ebd') OR
    public.has_role(auth.uid(), 'gerente_sorteio')
  );

CREATE POLICY "Admin can delete embaixadoras_cliques"
  ON public.embaixadoras_cliques
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente_ebd') OR
    public.has_role(auth.uid(), 'gerente_sorteio')
  );

CREATE POLICY "Admin can delete embaixadoras_vendas"
  ON public.embaixadoras_vendas
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'gerente_ebd') OR
    public.has_role(auth.uid(), 'gerente_sorteio')
  );
