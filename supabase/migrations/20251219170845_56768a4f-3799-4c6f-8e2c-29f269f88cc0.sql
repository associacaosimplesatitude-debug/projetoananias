-- Add admin policies for vendedor_propostas table

-- Admin can select all propostas
CREATE POLICY "Admins can select all propostas" 
ON public.vendedor_propostas 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can delete all propostas
CREATE POLICY "Admins can delete all propostas" 
ON public.vendedor_propostas 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin can update all propostas
CREATE POLICY "Admins can update all propostas" 
ON public.vendedor_propostas 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Gerente EBD can select all propostas
CREATE POLICY "Gerente EBD can select all propostas" 
ON public.vendedor_propostas 
FOR SELECT 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Gerente EBD can delete all propostas
CREATE POLICY "Gerente EBD can delete all propostas" 
ON public.vendedor_propostas 
FOR DELETE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Gerente EBD can update all propostas
CREATE POLICY "Gerente EBD can update all propostas" 
ON public.vendedor_propostas 
FOR UPDATE 
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));