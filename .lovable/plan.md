
# Historico Completo com Payloads e Webhooks

## Resumo

Adicionar ao historico de mensagens WhatsApp: o JSON enviado para a Z-API, a resposta recebida, e criar uma nova aba/secao para receber e exibir webhooks da Z-API.

## Alteracoes

### 1. Banco de Dados

**Adicionar 2 colunas na tabela `whatsapp_mensagens`:**
- `payload_enviado` (jsonb, nullable) - JSON exato enviado para a Z-API
- `resposta_recebida` (jsonb, nullable) - JSON da resposta da Z-API

**Nova tabela `whatsapp_webhooks`** para receber webhooks da Z-API:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| evento | text | Tipo do evento (ex: message-status, on-message-received) |
| payload | jsonb | JSON completo do webhook |
| telefone | text (nullable) | Telefone relacionado (extraido do payload) |
| message_id | text (nullable) | ID da mensagem na Z-API |
| created_at | timestamptz | Data de recebimento |

RLS: Apenas admins podem ler. A edge function insere via service role.

### 2. Edge Function `send-whatsapp-message` (atualizar)

Salvar o JSON enviado (`payload_enviado`) e a resposta da Z-API (`resposta_recebida`) no registro da mensagem.

### 3. Nova Edge Function `whatsapp-webhook`

Endpoint publico (sem auth) que:
- Recebe POST da Z-API com eventos (status de mensagem, mensagens recebidas, etc.)
- Salva tudo na tabela `whatsapp_webhooks`
- Retorna 200 OK

### 4. Frontend - Historico expandido

Na tabela de historico, cada linha tera um botao para expandir e ver:
- **Payload Enviado**: JSON formatado do que foi enviado
- **Resposta Z-API**: JSON formatado da resposta recebida
- **Erro**: detalhes do erro (ja existe)

### 5. Frontend - Nova aba "Webhooks"

Nova aba no painel WhatsApp mostrando:
- Tabela com todos os webhooks recebidos (ultimos 100)
- Colunas: Data, Evento, Telefone, Message ID
- Botao para expandir e ver o JSON completo do webhook

## Arquivos criados/alterados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar colunas + criar tabela webhooks |
| `supabase/functions/send-whatsapp-message/index.ts` | Salvar payload e resposta |
| `supabase/functions/whatsapp-webhook/index.ts` | Criar (receber webhooks) |
| `src/pages/admin/WhatsAppPanel.tsx` | Historico expandivel + aba Webhooks |
