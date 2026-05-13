
-- Permitir vendedor ler whatsapp_conversas dos telefones atribuídos a ele
CREATE POLICY "vendedor_le_whatsapp_conversas_atribuidas"
ON public.whatsapp_conversas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_conversas.telefone
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
  )
);

-- Permitir vendedor ler whatsapp_mensagens dos telefones atribuídos a ele
CREATE POLICY "vendedor_le_whatsapp_mensagens_atribuidas"
ON public.whatsapp_mensagens
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_mensagens.telefone_destino
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
  )
);

-- Permitir vendedor ler whatsapp_webhooks dos telefones atribuídos a ele
CREATE POLICY "vendedor_le_whatsapp_webhooks_atribuidos"
ON public.whatsapp_webhooks
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.agente_ia_conversas c
    WHERE c.telefone = whatsapp_webhooks.telefone
      AND c.vendedor_atribuido_id IS NOT NULL
      AND c.vendedor_atribuido_id = public.get_vendedor_id_by_email(public.get_auth_email())
  )
);
