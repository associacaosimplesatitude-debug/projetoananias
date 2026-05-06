## Problema

Na aba **Conversas** de `/admin/whatsapp`, ao abrir um contato (ex.: 11947141878), só aparecem as mensagens enviadas. As mensagens recebidas não aparecem mesmo existindo no banco (7 mensagens "user" para esse número em `whatsapp_conversas`).

## Causa raiz

A tabela `whatsapp_conversas` tem RLS habilitado mas a única policy existente é `"Service role full access"`. Não há policy permitindo `SELECT` para admins/gerente_ebd autenticados via app.

Resultado: o `supabase.from("whatsapp_conversas").select(...)` no `WhatsAppChat.tsx` (linha 210) retorna `[]` para o usuário admin logado, então só as mensagens da tabela `whatsapp_mensagens` (que tem policy de admin) aparecem.

As outras tabelas relacionadas (`whatsapp_mensagens`, `whatsapp_webhooks`) já têm policy de admin/gerente_ebd para SELECT — só `whatsapp_conversas` ficou sem.

## Correção

Migration única adicionando policy de SELECT em `whatsapp_conversas` para admin e gerente_ebd, no mesmo padrão das tabelas vizinhas:

```sql
CREATE POLICY "Admins can read whatsapp_conversas"
ON public.whatsapp_conversas
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY (ARRAY['admin'::app_role, 'gerente_ebd'::app_role])
  )
);
```

Nenhuma alteração de código frontend necessária — o `WhatsAppChat.tsx` já busca corretamente de `whatsapp_conversas` (role=user → recebida, role=assistant → enviada). Após a policy, as mensagens recebidas aparecerão automaticamente no chat.

## Escopo

- Apenas 1 migration SQL (criar policy de SELECT)
- Sem alterações em código frontend ou edge functions
