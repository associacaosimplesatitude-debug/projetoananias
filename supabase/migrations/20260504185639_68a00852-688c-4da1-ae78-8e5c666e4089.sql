CREATE OR REPLACE VIEW public.v_implementacoes_for_user
WITH (security_invoker=on) AS
SELECT n.id, n.tipo, n.titulo, n.descricao_curta, n.descricao_completa,
       n.versao, n.categoria, n.data_publicacao, n.ativo, n.audience_type,
       n.criado_por, n.created_at, n.updated_at,
       r.id IS NOT NULL AS lida, r.lido_em
FROM public.implementacoes n
LEFT JOIN public.implementacoes_reads r
  ON r.implementacao_id = n.id AND r.user_id = auth.uid()
WHERE n.ativo = true
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
    OR auth.uid() = '63e16695-5de5-42d0-babd-2a2711375ab2'::uuid
    OR n.audience_type = 'all'
    OR (n.audience_type = 'roles' AND EXISTS (
         SELECT 1 FROM public.user_roles ur
         WHERE ur.user_id = auth.uid()
           AND ur.role::text = ANY (n.audience_roles)
       ))
    OR (n.audience_type = 'users' AND auth.uid() = ANY (n.audience_user_ids))
  );