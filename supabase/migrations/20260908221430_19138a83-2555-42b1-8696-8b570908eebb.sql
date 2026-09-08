CREATE OR REPLACE FUNCTION public.get_dashboard_user_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_vendedor jsonb;
  v_vendedor_ci jsonb;
  v_ebd_cliente jsonb;
  v_super_role jsonb;
  v_lead jsonb;
  v_aluno jsonb;
  v_professor jsonb;
  v_church jsonb;
  v_profile jsonb;
  v_church_id uuid;
  v_modules text[] := ARRAY[]::text[];
  v_is_admin boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  v_email := lower(trim(coalesce(v_email, '')));

  -- vendedores (email exato, case-insensitive == ilike sem curinga)
  SELECT to_jsonb(t) INTO v_vendedor
  FROM (
    SELECT v.id, v.email
    FROM public.vendedores v
    WHERE lower(v.email) = v_email AND v_email <> ''
    LIMIT 1
  ) t;

  -- ebd_clientes como superintendente ativo
  SELECT to_jsonb(t) INTO v_ebd_cliente
  FROM (
    SELECT c.id, c.status_ativacao_ebd, c.tipo_cliente, c.nome_igreja
    FROM public.ebd_clientes c
    WHERE c.superintendente_user_id = v_uid
      AND c.status_ativacao_ebd = true
    LIMIT 1
  ) t;

  -- ebd_user_roles: superintendente promovido
  SELECT to_jsonb(t) INTO v_super_role
  FROM (
    SELECT r.id, r.church_id
    FROM public.ebd_user_roles r
    WHERE r.user_id = v_uid AND r.role = 'superintendente'
    LIMIT 1
  ) t;

  -- lead de reativação por email (case-insensitive)
  SELECT to_jsonb(t) INTO v_lead
  FROM (
    SELECT l.id, l.email, l.conta_criada, l.lead_score
    FROM public.ebd_leads_reativacao l
    WHERE lower(l.email) = v_email AND v_email <> ''
    LIMIT 1
  ) t;

  -- aluno ativo
  SELECT to_jsonb(t) INTO v_aluno
  FROM (
    SELECT a.id, a.turma_id, a.church_id
    FROM public.ebd_alunos a
    WHERE a.user_id = v_uid AND a.is_active = true
    LIMIT 1
  ) t;

  -- professor ativo
  SELECT to_jsonb(t) INTO v_professor
  FROM (
    SELECT p.id, p.church_id
    FROM public.ebd_professores p
    WHERE p.user_id = v_uid AND p.is_active = true
    LIMIT 1
  ) t;

  -- churches do próprio usuário
  SELECT to_jsonb(t) INTO v_church
  FROM (
    SELECT ch.id, ch.church_name, ch.process_status, ch.current_stage, ch.client_type
    FROM public.churches ch
    WHERE ch.user_id = v_uid
    LIMIT 1
  ) t;

  -- profile
  SELECT to_jsonb(t) INTO v_profile
  FROM (
    SELECT pr.avatar_url, pr.full_name, pr.church_id
    FROM public.profiles pr
    WHERE pr.id = v_uid
    LIMIT 1
  ) t;

  -- role admin (mesma semântica de acesso total do useActiveModules)
  SELECT public.has_role(v_uid, 'admin'::app_role) INTO v_is_admin;

  -- active modules replicando a ordem de prioridade atual
  IF v_is_admin THEN
    v_modules := ARRAY['REOBOTE IGREJAS', 'REOBOTE ASSOCIAÇÕES', 'REOBOTE EBD'];
  ELSIF v_vendedor IS NOT NULL THEN
    v_modules := ARRAY['REOBOTE EBD'];
  ELSIF v_ebd_cliente IS NOT NULL THEN
    v_modules := ARRAY['REOBOTE EBD'];
  ELSIF v_lead IS NOT NULL THEN
    v_modules := ARRAY['REOBOTE EBD'];
  ELSE
    v_church_id := COALESCE(
      (v_church->>'id')::uuid,
      (v_aluno->>'church_id')::uuid,
      (v_professor->>'church_id')::uuid
    );

    IF v_church_id IS NOT NULL THEN
      SELECT COALESCE(array_agg(m.nome_modulo) FILTER (WHERE m.nome_modulo IS NOT NULL), ARRAY[]::text[])
      INTO v_modules
      FROM public.assinaturas asg
      JOIN public.modulos m ON m.id = asg.modulo_id
      WHERE asg.cliente_id = v_church_id
        AND asg.status = 'Ativo';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_uid,
    'email', v_email,
    'is_admin', v_is_admin,
    'is_vendedor', v_vendedor IS NOT NULL,
    'vendedor', v_vendedor,
    'is_superintendente', (v_ebd_cliente IS NOT NULL OR v_super_role IS NOT NULL),
    'ebd_cliente', v_ebd_cliente,
    'ebd_super_role', v_super_role,
    'is_lead_reativacao', v_lead IS NOT NULL,
    'lead_reativacao', v_lead,
    'is_aluno', v_aluno IS NOT NULL,
    'aluno', v_aluno,
    'is_professor', v_professor IS NOT NULL,
    'professor', v_professor,
    'church', v_church,
    'profile', v_profile,
    'active_modules', to_jsonb(v_modules)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_user_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_user_context() TO service_role;