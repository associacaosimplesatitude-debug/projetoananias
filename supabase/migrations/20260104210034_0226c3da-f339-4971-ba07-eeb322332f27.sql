-- Função SECURITY DEFINER para checar permissão por igreja sem recursão em RLS
CREATE OR REPLACE FUNCTION public.is_ebd_superintendente_for_church(_user_id uuid, _church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_user_roles
    WHERE user_id = _user_id
      AND church_id = _church_id
      AND role = 'superintendente'::public.ebd_role
  )
  OR EXISTS (
    SELECT 1
    FROM public.ebd_clientes
    WHERE id = _church_id
      AND superintendente_user_id = _user_id
      AND status_ativacao_ebd = true
  )
$$;

-- Remover políticas antigas (recursivas) e duplicadas
DROP POLICY IF EXISTS "Superintendentes podem conceder roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes podem remover roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes podem ver roles da sua igreja" ON public.ebd_user_roles;

DROP POLICY IF EXISTS "Superintendentes can view all roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes can insert roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes can delete roles" ON public.ebd_user_roles;

-- Recriar políticas seguras usando SECURITY DEFINER
CREATE POLICY "Superintendentes can view roles for their church"
ON public.ebd_user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_ebd_superintendente_for_church(auth.uid(), church_id)
);

CREATE POLICY "Superintendentes can insert roles"
ON public.ebd_user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_ebd_superintendente_for_church(auth.uid(), church_id)
);

CREATE POLICY "Superintendentes can delete roles"
ON public.ebd_user_roles
FOR DELETE
TO authenticated
USING (
  public.is_ebd_superintendente_for_church(auth.uid(), church_id)
);

-- Remover função antiga (2 args) criada anteriormente para evitar ambiguidade
DROP FUNCTION IF EXISTS public.has_ebd_role(uuid, public.ebd_role);
