-- Recriar policies de timeline do WhatsApp para vendedor usando current_vendedor_id() (SECURITY DEFINER)
-- Substitui a lógica antiga get_vendedor_id_by_email(get_auth_email()) que dependia de chain de RLS.

DROP POLICY IF EXISTS "vendedor_le_whatsapp_conversas_atribuidas" ON public.whatsapp_conversas;
CREATE POLICY "vendedor_le_whatsapp_conversas_atribuidas"
ON public.whatsapp_conversas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_conversas.telefone
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.current_vendedor_id()
  )
);

DROP POLICY IF EXISTS "vendedor_le_whatsapp_mensagens_atribuidas" ON public.whatsapp_mensagens;
CREATE POLICY "vendedor_le_whatsapp_mensagens_atribuidas"
ON public.whatsapp_mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_mensagens.telefone_destino
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.current_vendedor_id()
  )
);

DROP POLICY IF EXISTS "vendedor_le_whatsapp_webhooks_atribuidos" ON public.whatsapp_webhooks;
CREATE POLICY "vendedor_le_whatsapp_webhooks_atribuidos"
ON public.whatsapp_webhooks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_webhooks.telefone
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.current_vendedor_id()
  )
);

-- Permitir gerente_ebd inserir mensagens enviadas (já existe para admin/gerente, garantir idempotência)
DROP POLICY IF EXISTS "Admins can insert whatsapp_mensagens" ON public.whatsapp_mensagens;
CREATE POLICY "Admins can insert whatsapp_mensagens"
ON public.whatsapp_mensagens
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin'::app_role, 'gerente_ebd'::app_role)
  )
);

NOTIFY pgrst, 'reload schema';