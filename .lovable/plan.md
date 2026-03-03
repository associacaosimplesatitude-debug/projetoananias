

## Plano: Corrigir teste de conexão para funcionar com permissão whatsapp_business_messaging

### Problema

O token do System User possui apenas `whatsapp_business_messaging`. O endpoint `GET /v22.0/{WABA_ID}/phone_numbers` exige `whatsapp_business_management`, causando erro 100/subcode 33.

### Solução

Alterar a action `test_connection` na edge function `whatsapp-meta-test` para consultar diretamente o Phone Number ID via `GET /v22.0/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, que funciona com `whatsapp_business_messaging`.

### Alterações

#### 1. Edge function `whatsapp-meta-test/index.ts`
- Action `test_connection`: aceitar `phone_number_id` como parâmetro (além do `business_account_id`)
- Consultar `GET /v22.0/{phone_number_id}?fields=display_phone_number,verified_name,quality_rating` ao invés de listar via WABA
- Se WABA ID também estiver disponível, tentar listar (fallback), mas priorizar o Phone Number ID
- Retornar os dados do número no mesmo formato atual (`phone_numbers` array)

#### 2. Frontend `WhatsAppPanel.tsx`
- Passar `phone_number_id` junto no body da chamada `testConnection`

### Detalhe técnico

```text
Antes:  GET /v22.0/{WABA_ID}/phone_numbers  → requer whatsapp_business_management ❌
Depois: GET /v22.0/{PHONE_NUMBER_ID}?fields=...  → funciona com whatsapp_business_messaging ✅
```

