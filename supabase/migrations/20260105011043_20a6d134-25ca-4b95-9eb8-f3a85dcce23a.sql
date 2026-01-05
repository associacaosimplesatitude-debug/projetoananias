-- Ajustar função para também permitir o usuário dono da igreja (churches.user_id)
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
  OR EXISTS (
    SELECT 1
    FROM public.churches
    WHERE id = _church_id
      AND user_id = _user_id
  )
$$;