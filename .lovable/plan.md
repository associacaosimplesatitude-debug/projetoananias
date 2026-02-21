

# Webhook para WhatsApp Cloud API (Meta)

## O que sera feito

Criar uma nova Edge Function chamada `whatsapp-meta-webhook` que servira como endpoint publico para a WhatsApp Cloud API da Meta.

A funcao existente `whatsapp-webhook` continuara funcionando normalmente para a Z-API. Esta sera uma funcao completamente separada.

## Funcionalidade

### GET - Verificacao do webhook
- Le os parametros `hub.mode`, `hub.verify_token` e `hub.challenge` da URL
- Se `hub.verify_token` for igual a `MEU_VERIFY_TOKEN_123`, retorna `hub.challenge` com status 200
- Caso contrario, retorna 403

### POST - Recebimento de eventos
- Recebe o body JSON da Meta
- Loga o payload completo no console
- Salva o evento na tabela `whatsapp_webhooks` para auditoria
- Retorna status 200 imediatamente

## URL final publica

A URL para cadastrar no Meta Developers sera:

```
https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/whatsapp-meta-webhook
```

**Nota importante:** O dominio `gestaoebd.com.br` aponta para o frontend (Lovable). Edge Functions sao acessadas diretamente pela URL do backend, que e a URL acima. Esta e a URL que deve ser cadastrada no Meta Developers.

## Detalhes tecnicos

### Novo arquivo: `supabase/functions/whatsapp-meta-webhook/index.ts`

- Metodo GET: parseia `req.url` para extrair query params, valida verify_token, retorna challenge
- Metodo POST: faz `req.json()`, loga com `console.log`, insere em `whatsapp_webhooks`, retorna 200
- CORS headers para permitir acesso publico
- Sem autenticacao (verify_jwt = false)

### Configuracao: `supabase/config.toml`

Adicionar:
```
[functions.whatsapp-meta-webhook]
verify_jwt = false
```

