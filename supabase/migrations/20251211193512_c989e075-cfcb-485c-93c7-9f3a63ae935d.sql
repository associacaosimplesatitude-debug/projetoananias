-- Add RLS policies for gerente_ebd role to manage vendedores
CREATE POLICY "Gerente EBD can select vendedores"
ON public.vendedores
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can insert vendedores"
ON public.vendedores
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can update vendedores"
ON public.vendedores
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can delete vendedores"
ON public.vendedores
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add RLS policies for gerente_ebd role to manage leads de reativacao
CREATE POLICY "Gerente EBD can select leads"
ON public.ebd_leads_reativacao
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can update leads"
ON public.ebd_leads_reativacao
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role))
WITH CHECK (has_role(auth.uid(), 'gerente_ebd'::app_role));

-- Add read-only policies for gerente_ebd to view other EBD data
CREATE POLICY "Gerente EBD can select churches"
ON public.churches
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select assinaturas"
ON public.assinaturas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_clientes"
ON public.ebd_clientes
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_shopify_pedidos"
ON public.ebd_shopify_pedidos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_pedidos"
ON public.ebd_pedidos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_pedidos_itens"
ON public.ebd_pedidos_itens
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select modulos"
ON public.modulos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_planejamento"
ON public.ebd_planejamento
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_alunos"
ON public.ebd_alunos
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_professores"
ON public.ebd_professores
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Gerente EBD can select ebd_turmas"
ON public.ebd_turmas
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));