-- Fix RLS policies to avoid querying auth.users (permission denied)
-- Use email from JWT claims instead.

-- Drop existing policies
DROP POLICY IF EXISTS "Representantes podem ver descontos de seus clientes" ON public.ebd_descontos_categoria_representante;
DROP POLICY IF EXISTS "Representantes podem inserir descontos para seus clientes" ON public.ebd_descontos_categoria_representante;
DROP POLICY IF EXISTS "Representantes podem atualizar descontos de seus clientes" ON public.ebd_descontos_categoria_representante;
DROP POLICY IF EXISTS "Representantes podem deletar descontos de seus clientes" ON public.ebd_descontos_categoria_representante;

-- Recreate policies using JWT email claim
CREATE POLICY "Representantes podem ver descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR SELECT
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.ebd_clientes c
      JOIN public.vendedores v ON c.vendedor_id = v.id
      WHERE c.id = ebd_descontos_categoria_representante.cliente_id
        AND v.tipo_perfil = 'representante'
        AND v.email = (auth.jwt() ->> 'email')
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);

CREATE POLICY "Representantes podem inserir descontos para seus clientes"
ON public.ebd_descontos_categoria_representante
FOR INSERT
TO authenticated
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.ebd_clientes c
      JOIN public.vendedores v ON c.vendedor_id = v.id
      WHERE c.id = ebd_descontos_categoria_representante.cliente_id
        AND v.tipo_perfil = 'representante'
        AND v.email = (auth.jwt() ->> 'email')
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);

CREATE POLICY "Representantes podem atualizar descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR UPDATE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.ebd_clientes c
      JOIN public.vendedores v ON c.vendedor_id = v.id
      WHERE c.id = ebd_descontos_categoria_representante.cliente_id
        AND v.tipo_perfil = 'representante'
        AND v.email = (auth.jwt() ->> 'email')
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
)
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.ebd_clientes c
      JOIN public.vendedores v ON c.vendedor_id = v.id
      WHERE c.id = ebd_descontos_categoria_representante.cliente_id
        AND v.tipo_perfil = 'representante'
        AND v.email = (auth.jwt() ->> 'email')
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);

CREATE POLICY "Representantes podem deletar descontos de seus clientes"
ON public.ebd_descontos_categoria_representante
FOR DELETE
TO authenticated
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.ebd_clientes c
      JOIN public.vendedores v ON c.vendedor_id = v.id
      WHERE c.id = ebd_descontos_categoria_representante.cliente_id
        AND v.tipo_perfil = 'representante'
        AND v.email = (auth.jwt() ->> 'email')
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gerente_ebd'::app_role)
);
