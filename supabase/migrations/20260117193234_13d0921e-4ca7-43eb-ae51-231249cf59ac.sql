
-- Adicionar política SELECT para financeiro em vendedor_propostas_parcelas
CREATE POLICY "Financeiro can view all parcelas"
ON public.vendedor_propostas_parcelas
FOR SELECT
USING (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política UPDATE para financeiro em vendedor_propostas_parcelas (para marcar como paga)
CREATE POLICY "Financeiro can update parcelas"
ON public.vendedor_propostas_parcelas
FOR UPDATE
USING (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política SELECT para gerente_ebd em vendedor_propostas_parcelas
CREATE POLICY "Gerente EBD can view all parcelas"
ON public.vendedor_propostas_parcelas
FOR SELECT
USING (public.has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Adicionar política UPDATE para gerente_ebd em vendedor_propostas_parcelas
CREATE POLICY "Gerente EBD can update parcelas"
ON public.vendedor_propostas_parcelas
FOR UPDATE
USING (public.has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Adicionar política SELECT para financeiro em vendedores
CREATE POLICY "Financeiro can view vendedores"
ON public.vendedores
FOR SELECT
USING (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política SELECT para financeiro em ebd_clientes
CREATE POLICY "Financeiro can view ebd_clientes"
ON public.ebd_clientes
FOR SELECT
USING (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política SELECT para financeiro em comissao_lotes_pagamento
CREATE POLICY "Financeiro can view lotes"
ON public.comissao_lotes_pagamento
FOR SELECT
USING (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política INSERT para financeiro em comissao_lotes_pagamento
CREATE POLICY "Financeiro can insert lotes"
ON public.comissao_lotes_pagamento
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'financeiro'::app_role));

-- Adicionar política UPDATE para financeiro em comissao_lotes_pagamento
CREATE POLICY "Financeiro can update lotes"
ON public.comissao_lotes_pagamento
FOR UPDATE
USING (public.has_role(auth.uid(), 'financeiro'::app_role));
