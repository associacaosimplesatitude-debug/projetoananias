

## Plano: Atualizar edge function `send-whatsapp-message` para usar a API Oficial do WhatsApp (Meta)

### Problema
A edge function `send-whatsapp-message` ainda usa a Z-API. Precisa ser atualizada para usar a Meta Cloud API (Graph API v21.0).

### Alteração

**Arquivo**: `supabase/functions/send-whatsapp-message/index.ts`

Reescrever a função para:

1. **Buscar credenciais Meta** do `system_settings`: `whatsapp_phone_number_id` e `whatsapp_access_token` (em vez de `zapi_instance_id`, `zapi_token`, `zapi_client_token`)

2. **Formatar número** para o padrão internacional (adicionar `55` se necessário, remover caracteres não numéricos)

3. **Enviar via Graph API**:
   - Texto: `POST https://graph.facebook.com/v21.0/{phone_number_id}/messages` com payload `{ messaging_product: "whatsapp", to: telefone, type: "text", text: { body: mensagem } }`
   - Imagem: mesmo endpoint com `type: "image"` e `image: { link: imagem_url, caption: mensagem }`
   - Header: `Authorization: Bearer {access_token}`

4. **Manter o log** na tabela `whatsapp_mensagens` com payload e resposta

Após o deploy, será possível enviar mensagem de teste diretamente pelo painel WhatsApp existente (`/admin/ebd/whatsapp`).

