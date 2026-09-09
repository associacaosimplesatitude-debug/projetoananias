-- ============ ebd_shopify_pedidos_itens ============
DROP POLICY IF EXISTS "Authenticated users can view pedido items" ON public.ebd_shopify_pedidos_itens;
DROP POLICY IF EXISTS "View items of visible pedidos" ON public.ebd_shopify_pedidos_itens;
CREATE POLICY "View items of visible pedidos"
ON public.ebd_shopify_pedidos_itens
FOR SELECT TO authenticated
USING (pedido_id IN (SELECT id FROM public.ebd_shopify_pedidos));

-- ============ embaixadoras_cliques ============
DROP POLICY IF EXISTS "select_admin_cliques" ON public.embaixadoras_cliques;
DROP POLICY IF EXISTS "Admins can view embaixadoras_cliques" ON public.embaixadoras_cliques;
CREATE POLICY "Admins can view embaixadoras_cliques"
ON public.embaixadoras_cliques
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente_ebd'::app_role)
  OR public.has_role(auth.uid(), 'gerente_sorteio'::app_role)
);

DROP POLICY IF EXISTS "permitir_update_cliques_anon" ON public.embaixadoras_cliques;

-- ============ revista_acessos_geo ============
DROP POLICY IF EXISTS "anon_select_own" ON public.revista_acessos_geo;
DROP POLICY IF EXISTS "anon_update" ON public.revista_acessos_geo;
DROP POLICY IF EXISTS "anon_update_recent" ON public.revista_acessos_geo;
CREATE POLICY "anon_update_recent"
ON public.revista_acessos_geo
FOR UPDATE TO anon
USING (created_at > now() - interval '15 minutes')
WITH CHECK (created_at > now() - interval '15 minutes');

-- ============ revista_licencas ============
DROP POLICY IF EXISTS "anon_select_by_codigo_pagamento" ON public.revista_licencas;

CREATE OR REPLACE FUNCTION public.get_licenca_by_codigo(_codigo text)
RETURNS TABLE (
  id uuid,
  superintendente_id uuid,
  chave_pix text,
  codigo_pagamento text,
  quantidade_total integer,
  quantidade_usada integer,
  status text,
  revista_aluno_id uuid,
  revista_professor_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.id, l.superintendente_id, l.chave_pix, l.codigo_pagamento,
         l.quantidade_total, l.quantidade_usada, l.status,
         l.revista_aluno_id, l.revista_professor_id
  FROM public.revista_licencas l
  WHERE _codigo IS NOT NULL
    AND length(_codigo) >= 6
    AND l.codigo_pagamento = _codigo
  LIMIT 1;
$$;

-- ============ revista_progresso ============
DROP POLICY IF EXISTS "Users read own progresso" ON public.revista_progresso;
DROP POLICY IF EXISTS "Users update own progresso" ON public.revista_progresso;
DROP POLICY IF EXISTS "Users upsert own progresso" ON public.revista_progresso;
DROP POLICY IF EXISTS "Read own progresso" ON public.revista_progresso;
DROP POLICY IF EXISTS "Insert own progresso" ON public.revista_progresso;
DROP POLICY IF EXISTS "Update own progresso" ON public.revista_progresso;

CREATE OR REPLACE FUNCTION public.owns_revista_progresso(_cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.ebd_clientes c
      WHERE c.id = _cliente_id
        AND (c.superintendente_user_id = auth.uid()
             OR lower(c.email_superintendente) = lower(coalesce(auth.jwt() ->> 'email', '')))
    )
    OR EXISTS (
      SELECT 1 FROM public.ebd_alunos a
      WHERE a.user_id = auth.uid() AND a.church_id = _cliente_id
    )
    OR EXISTS (
      SELECT 1 FROM public.ebd_professores p
      WHERE p.user_id = auth.uid() AND p.church_id = _cliente_id
    );
$$;

CREATE POLICY "Read own progresso"
ON public.revista_progresso FOR SELECT TO authenticated
USING (public.owns_revista_progresso(cliente_id) OR public.is_admin_geral(auth.uid()));

CREATE POLICY "Insert own progresso"
ON public.revista_progresso FOR INSERT TO authenticated
WITH CHECK (public.owns_revista_progresso(cliente_id));

CREATE POLICY "Update own progresso"
ON public.revista_progresso FOR UPDATE TO authenticated
USING (public.owns_revista_progresso(cliente_id))
WITH CHECK (public.owns_revista_progresso(cliente_id));

-- ============ whatsapp_templates ============
DROP POLICY IF EXISTS "Authenticated users can view templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Authenticated users can create templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Authenticated users can update templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Authenticated users can delete templates" ON public.whatsapp_templates;
DROP POLICY IF EXISTS "Admins manage whatsapp_templates" ON public.whatsapp_templates;

CREATE POLICY "Admins manage whatsapp_templates"
ON public.whatsapp_templates FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente_ebd'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gerente_ebd'::app_role)
);

-- ============ search_path fix ============
ALTER FUNCTION public.get_funil_stage_list(uuid, text, integer) SET search_path = public;

-- ============ view: enforce caller RLS ============
ALTER VIEW public.whatsapp_contatos_360 SET (security_invoker = on);

-- ============ SECURITY DEFINER function grants ============
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF NOT r.is_trigger THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    ELSE
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;

-- RPCs legitimately called by anonymous public pages
GRANT EXECUTE ON FUNCTION public.get_licenca_by_codigo(text) TO anon;

-- Arbitrary read-only SQL must never be reachable from a browser session
REVOKE EXECUTE ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO service_role;