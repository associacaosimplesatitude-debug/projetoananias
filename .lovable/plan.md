

## Plano: Substituir Z-API pela API Oficial do WhatsApp (Meta Cloud API)

### Campos necessários para a API Oficial do WhatsApp

A API oficial do WhatsApp (Meta Cloud API) requer os seguintes campos:

1. **Phone Number ID** — ID do número de telefone no Meta Business (encontrado em WhatsApp > API Setup)
2. **WhatsApp Business Account ID** — ID da conta Business do WhatsApp
3. **Access Token** — Token de acesso permanente gerado no Meta Business
4. **Verify Token** — Token de verificação para o webhook (definido pelo usuário)

### Alterações

**Arquivo**: `src/pages/vendedor/VendedorIntegracoes.tsx`

1. Substituir o card "Credenciais Z-API" por "API Oficial do WhatsApp (Meta)"
2. Trocar os 3 campos (Instance ID, Token, Client Token) por 4 campos:
   - **Phone Number ID** → `whatsapp_phone_number_id`
   - **WhatsApp Business Account ID** → `whatsapp_business_account_id`
   - **Access Token** (campo senha) → `whatsapp_access_token`
   - **Verify Token** → `whatsapp_verify_token`
3. Atualizar `loadCredentials` e `saveCredentials` para usar as novas chaves no `system_settings`
4. Manter os botões "Salvar" e "Testar Conexão" (teste chamará a Graph API do Meta para validar o token)
5. Exibir a URL do webhook para configurar no Meta: `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-webhook/whatsapp-meta-webhook`
6. Manter o card da Z-API separado abaixo (colapsado) como legado, caso ainda precise consultar

### Detalhes técnicos

- As chaves serão salvas em `system_settings` com as keys: `whatsapp_phone_number_id`, `whatsapp_business_account_id`, `whatsapp_access_token`, `whatsapp_verify_token`
- O teste de conexão fará um GET para `https://graph.facebook.com/v21.0/{phone_number_id}` com o Access Token para validar
- As edge functions de envio (`send-whatsapp-message`) serão atualizadas em uma etapa posterior para usar a Graph API em vez da Z-API

