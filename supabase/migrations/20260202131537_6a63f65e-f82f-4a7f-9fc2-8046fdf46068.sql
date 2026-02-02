-- Atualizar função has_royalties_access para incluir financeiro
CREATE OR REPLACE FUNCTION public.has_royalties_access(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'gerente_royalties', 'financeiro')
  )
$function$;