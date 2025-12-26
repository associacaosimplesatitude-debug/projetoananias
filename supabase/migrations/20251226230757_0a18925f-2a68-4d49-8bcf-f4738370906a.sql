-- Add RLS policies for financeiro role to manage vendedor_propostas

-- Financeiro can SELECT vendedor_propostas
CREATE POLICY "Financeiro can select vendedor_propostas"
ON public.vendedor_propostas
FOR SELECT
USING (has_role(auth.uid(), 'financeiro'::app_role));

-- Financeiro can DELETE vendedor_propostas
CREATE POLICY "Financeiro can delete vendedor_propostas"
ON public.vendedor_propostas
FOR DELETE
USING (has_role(auth.uid(), 'financeiro'::app_role));

-- Financeiro can UPDATE vendedor_propostas
CREATE POLICY "Financeiro can update vendedor_propostas"
ON public.vendedor_propostas
FOR UPDATE
USING (has_role(auth.uid(), 'financeiro'::app_role));