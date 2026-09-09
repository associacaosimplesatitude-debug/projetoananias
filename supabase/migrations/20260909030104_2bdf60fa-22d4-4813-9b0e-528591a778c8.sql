-- 1. search_path fixo
ALTER FUNCTION public.normalizar_termo_busca(text) SET search_path = public;
ALTER FUNCTION public.variantes_telefone(text) SET search_path = public;

-- 2. Revogar EXECUTE de funções internas (gatilhos e rotinas de serviço)
DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    'adicionar_pontos_aluno','devolver_conversa_para_agente','encaminhar_conversa_para_vendedor',
    'get_cliente_by_documento','get_dashboard_user_context','get_funil_stage_counts','get_funil_stage_list',
    'get_publicos_revistas_por_mes','get_resumo_diario_canal_pedidos','get_resumo_diario_publico',
    'get_retencao_dashboard','get_sales_channel_totals','get_vendedor_public','transfer_cliente_vendedor',
    'whatsapp_publico_contar','whatsapp_publico_materializar','whatsapp_publico_recalcular',
    'has_role','has_church_permission','has_ebd_role','has_royalties_access','is_royalties_autor',
    'is_admin_geral','is_ebd_superintendent','is_ebd_superintendente','is_ebd_superintendente_for_church',
    'is_financeiro_or_admin','is_vendedor','can_manage_revistas','can_view_implementacao',
    'owns_revista_progresso','current_vendedor_id','get_auth_email','get_autor_id_by_user',
    'get_co_professor_ids','get_student_turma_id','get_vendedor_id_by_email',
    'normalizar_telefone_whatsapp','normalizar_termo_busca','variantes_telefone',
    'whatsapp_dentro_quiet_hours','calculate_next_purchase_date','calcular_preco_para_cliente',
    'buscar_catalogo_unificado'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY(keep))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Gatilhos (mesmo os não-definer) não precisam ser chamáveis via API
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- A consulta pública de licença passa a ser feita por edge function (service role)
REVOKE ALL ON FUNCTION public.get_licenca_by_codigo(text) FROM anon, authenticated, PUBLIC;

-- 3. royalties_autores: expor publicamente apenas colunas não sensíveis
REVOKE SELECT ON public.royalties_autores FROM anon;
GRANT SELECT (id, nome_completo, foto_url, bio, is_active) ON public.royalties_autores TO anon;

-- 4. Realtime: restringir tópicos de retenção
DROP POLICY IF EXISTS "Authenticated users can access allowed realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can send to allowed realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated users can access allowed realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  (realtime.topic() <> ALL (ARRAY[
    'realtime:public:ebd_shopify_pedidos',
    'realtime:public:ebd_shopify_pedidos_cg',
    'realtime:public:church_stage_progress',
    'realtime:public:ebd_onboarding_progress',
    'realtime:public:ebd_retencao_contatos',
    'realtime:public:retencao_campanhas',
    'realtime:public:retencao_disparos',
    'realtime:public:retencao_respostas'
  ]))
  OR COALESCE(public.has_role(auth.uid(), 'admin'::app_role), false)
  OR COALESCE(public.has_role(auth.uid(), 'superadmin'::app_role), false)
  OR COALESCE(public.has_role(auth.uid(), 'gerente_ebd'::app_role), false)
);

CREATE POLICY "Authenticated users can send to allowed realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  (realtime.topic() <> ALL (ARRAY[
    'realtime:public:ebd_shopify_pedidos',
    'realtime:public:ebd_shopify_pedidos_cg',
    'realtime:public:church_stage_progress',
    'realtime:public:ebd_onboarding_progress',
    'realtime:public:ebd_retencao_contatos',
    'realtime:public:retencao_campanhas',
    'realtime:public:retencao_disparos',
    'realtime:public:retencao_respostas'
  ]))
  OR COALESCE(public.has_role(auth.uid(), 'admin'::app_role), false)
  OR COALESCE(public.has_role(auth.uid(), 'superadmin'::app_role), false)
  OR COALESCE(public.has_role(auth.uid(), 'gerente_ebd'::app_role), false)
);