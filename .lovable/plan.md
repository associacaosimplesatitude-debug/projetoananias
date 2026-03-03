

## Plano: Corrigir recebimento de mensagens via Meta webhook e exibição em conversas

### Diagnóstico

Identifiquei **dois problemas**:

1. **O webhook Meta NÃO salva mensagens recebidas em `whatsapp_conversas`**. O handler da rota `whatsapp-meta-webhook` (linhas 240-273 do `whatsapp-webhook/index.ts`) apenas salva o payload bruto em `whatsapp_webhooks`, mas **não extrai o texto da mensagem e não insere em `whatsapp_conversas`**. Por isso, respostas dos clientes via Meta Cloud API nunca aparecem no chat do painel.

2. **Token de verificação inconsistente**. O código usa `"MEU_VERIFY_TOKEN_123"` mas a configuração documentada menciona `"centralgospel123"`. Se o webhook no Meta Developers estiver configurado com um token diferente, as mensagens nunca chegarão.

### Alterações

**Arquivo: `supabase/functions/whatsapp-webhook/index.ts`**

Na seção do Meta webhook (POST, linhas 240-273), adicionar a mesma lógica de persistência que já existe para Z-API:

1. Extrair `message.text.body` (texto), `message.image` (imagem), `message.audio` (áudio) do payload Meta
2. Inserir em `whatsapp_conversas` com `role: "user"`, `telefone`, `content`, `imagem_url`, `audio_url`
3. Buscar `cliente_id` por variantes de telefone (mesma lógica já usada no path Z-API)
4. Opcionalmente acionar o Agente de IA se ativo
5. Corrigir o verify token para `"centralgospel123"` (conforme configurado no Meta Developers)

### Resumo
- 1 arquivo alterado: `supabase/functions/whatsapp-webhook/index.ts`
- Sem migração de banco
- Redeploy automático da edge function

