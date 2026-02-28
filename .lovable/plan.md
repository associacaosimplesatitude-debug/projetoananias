

## Plano: Corrigir e melhorar validação da integração WhatsApp Meta Cloud API

### 1. Reescrever edge function `whatsapp-meta-test`

**Arquivo**: `supabase/functions/whatsapp-meta-test/index.ts`

Aceitar um campo `action` no body para distinguir entre:

- **`action: "test_connection"`**: Usa `GET https://graph.facebook.com/v22.0/{WABA_ID}/phone_numbers` para validar conexão. Retorna lista de números disponíveis. Depois busca detalhes de cada número via `GET .../{phone_id}?fields=display_phone_number,verified_name,quality_rating`.

- **`action: "test_send"`**: Envia `POST https://graph.facebook.com/v22.0/{PHONE_NUMBER_ID}/messages` com mensagem de teste para o número informado.

Inclui diagnóstico de erros: mapeia mensagens da Meta ("Unsupported get request", "Missing permissions", "Template does not exist") para mensagens amigáveis em português.

### 2. Atualizar `send-whatsapp-message` para v22.0

**Arquivo**: `supabase/functions/send-whatsapp-message/index.ts`

- Trocar `v21.0` por `v22.0` em todas as URLs da Graph API.

### 3. Refatorar página de Integrações

**Arquivo**: `src/pages/vendedor/VendedorIntegracoes.tsx`

- **Validação antes de salvar**: Phone Number ID numérico, WABA ID numérico, Access Token iniciando com `EAA`, nenhum campo vazio. Botão "Salvar" desabilitado se inválido.

- **Testar Conexão**: Chama `whatsapp-meta-test` com `action: "test_connection"` passando `business_account_id` e `access_token`. Exibe lista de números encontrados com nome verificado e quality rating.

- **Novo botão "Testar Envio"**: Campo para número de teste + botão. Chama `whatsapp-meta-test` com `action: "test_send"`, passando `phone_number_id`, `access_token` e `test_number`. Exibe resultado (sucesso/erro com diagnóstico).

- **Diagnóstico de erros**: Exibe mensagens traduzidas baseadas no tipo de erro retornado pela Meta.

- **Logs no console**: `console.log` com endpoint, status HTTP e body de resposta em cada operação.

### Detalhes técnicos

- A validação de conexão usa `WABA_ID/phone_numbers` (não GET direto no phone_number_id)
- O teste de envio usa `POST {phone_number_id}/messages` (v22.0)
- Os detalhes do número são buscados via `GET {phone_number_id}?fields=display_phone_number,verified_name,quality_rating` apenas após confirmar que o ID é válido via listagem do WABA
- Mapeamento de erros no edge function e exibição formatada no frontend

