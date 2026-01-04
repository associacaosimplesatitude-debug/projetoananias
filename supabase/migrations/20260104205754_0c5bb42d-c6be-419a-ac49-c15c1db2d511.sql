-- Criar função SECURITY DEFINER para verificar roles sem recursão
CREATE OR REPLACE FUNCTION public.has_ebd_role(_user_id uuid, _role ebd_role)
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
      AND role = _role
  )
$$;

-- Remover políticas existentes que causam recursão
DROP POLICY IF EXISTS "Users can view their own roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes can manage roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes can insert roles" ON public.ebd_user_roles;
DROP POLICY IF EXISTS "Superintendentes can delete roles" ON public.ebd_user_roles;

-- Criar políticas usando a função SECURITY DEFINER
CREATE POLICY "Users can view their own roles"
ON public.ebd_user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Superintendentes can view all roles"
ON public.ebd_user_roles
FOR SELECT
TO authenticated
USING (public.has_ebd_role(auth.uid(), 'superintendente'));

CREATE POLICY "Superintendentes can insert roles"
ON public.ebd_user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_ebd_role(auth.uid(), 'superintendente'));

CREATE POLICY "Superintendentes can delete roles"
ON public.ebd_user_roles
FOR DELETE
TO authenticated
USING (public.has_ebd_role(auth.uid(), 'superintendente'));