-- Adicionar 'representante' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'representante';

-- Adicionar coluna tipo_perfil na tabela vendedores para distinguir VENDEDOR de REPRESENTANTE
ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS tipo_perfil text NOT NULL DEFAULT 'vendedor';

-- Adicionar constraint para garantir valores válidos
ALTER TABLE public.vendedores 
ADD CONSTRAINT vendedores_tipo_perfil_check 
CHECK (tipo_perfil IN ('vendedor', 'representante'));

-- Criar política RLS para representantes acessarem seus próprios clientes (ebd_clientes)
CREATE POLICY "Representantes can view their assigned clients"
ON public.ebd_clientes
FOR SELECT
USING (vendedor_id = get_vendedor_id_by_email(get_auth_email()));

CREATE POLICY "Representantes can select assigned client orders"
ON public.ebd_pedidos
FOR SELECT
USING (
  church_id IN (
    SELECT id FROM public.ebd_clientes 
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

CREATE POLICY "Representantes can insert orders for assigned clients"
ON public.ebd_pedidos
FOR INSERT
WITH CHECK (
  church_id IN (
    SELECT id FROM public.ebd_clientes 
    WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
  )
);

-- Permitir que gerente_ebd também crie vendedores
-- (já existe política para admin, precisamos permitir gerente_ebd também no create-vendedor)