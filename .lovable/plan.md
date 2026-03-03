

## Plano: Substituir credenciais Z-API por API Oficial do WhatsApp na tela /admin/ebd/whatsapp

### Contexto

A tela `/admin/ebd/whatsapp` (arquivo `WhatsAppPanel.tsx`) ainda exibe a aba "Credenciais Z-API" com campos de Instance ID, Token e Client Token da Z-API. O sistema já migrou para a API Oficial da Meta, e as credenciais corretas já estão salvas no banco:

- **Phone Number ID**: `1050166738160490` (+55 21 99606-0743, Central Gospel)
- **WABA ID**: precisa ser atualizado para `925435919846260` (conforme screenshot da Meta)
- **Access Token**: `EAAaJ7mIEXVMBQ...` (gerado pelo System User `61568132410994`)
- **Verify Token**: `centralgospel123`

### Alterações

#### 1. Reescrever `CredentialsTab` em `WhatsAppPanel.tsx`

Substituir completamente a seção de credenciais Z-API por campos da API Oficial Meta:

- **Phone Number ID** (pré-preenchido: `1050166738160490`)
- **WhatsApp Business Account ID** (pré-preenchido: `925435919846260`)
- **Access Token** (campo password, pré-preenchido do banco)
- **Verify Token** (pré-preenchido do banco)
- **URL do Webhook** (read-only, copiável)
- Validação: Phone Number ID e WABA ID numéricos, Access Token iniciando com `EAA`
- Botões: **Salvar Credenciais**, **Testar Conexão** (usa edge function `whatsapp-meta-test` action `test_connection`), **Testar Envio** (campo de número + botão)
- Exibir status da conexão, números encontrados, diagnóstico de erros em português
- Manter toggles de **Envio Automático** e **Agente de IA**

#### 2. Atualizar referências Z-API

- Trocar título "WhatsApp" / subtítulo de "Z-API" para "API Oficial Meta"
- Renomear aba "Credenciais Z-API" para "Credenciais API"
- Remover toda lógica de `zapi_instance_id`, `zapi_token`, `zapi_client_token`
- Remover chamadas à edge function `zapi-instance-info`

#### 3. Corrigir WABA ID no banco

- Atualizar `whatsapp_business_account_id` de `1437089197463918` para `925435919846260` (ID correto da conta "Central Gospel" conforme screenshot)

### Detalhes técnicos

- A `CredentialsTab` carregará as 4 chaves da Meta de `system_settings` (`whatsapp_phone_number_id`, `whatsapp_business_account_id`, `whatsapp_access_token`, `whatsapp_verify_token`)
- Testar Conexão chama `supabase.functions.invoke("whatsapp-meta-test", { body: { action: "test_connection", business_account_id, access_token } })`
- Testar Envio chama `supabase.functions.invoke("whatsapp-meta-test", { body: { action: "test_send", phone_number_id, access_token, test_number } })`
- Webhook URL: `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-webhook/whatsapp-meta-webhook`

