
# Agente IA para WhatsApp - Primeira Compra EBD

## Visao Geral

Transformar o webhook da Z-API em um agente inteligente que:
1. Recebe mensagens dos clientes via Z-API
2. Usa OpenAI para entender a intencao (quer acesso, tem duvida sobre o sistema, etc.)
3. Responde automaticamente com credenciais OU resposta contextual sobre o sistema
4. Funciona em qualquer fase do funil

## Como Funciona Hoje

```text
Webhook Z-API → whatsapp-webhook → salva no banco (whatsapp_webhooks) → FIM
```

O webhook atual apenas armazena os eventos. Nao processa nem responde.

## Novo Fluxo

```text
Cliente responde WhatsApp
  → Z-API envia webhook para whatsapp-webhook
  → Identifica que e mensagem de texto recebida
  → Busca contexto do cliente (telefone → ebd_clientes → tracking)
  → Envia para OpenAI com prompt contextual
  → OpenAI decide a acao:
      a) "quer_acesso" → Envia Mensagem 2 (credenciais)
      b) "duvida_sistema" → Responde com orientacao sobre o sistema
      c) "outro" → Resposta generica amigavel
  → Envia resposta via Z-API
  → Registra tudo em whatsapp_mensagens
```

## Alteracoes

### 1. Salvar a API Key da OpenAI como secret
Voce ja tem a chave do projeto "PRIMEIRA COMPRA EBD". Vamos armazena-la de forma segura para uso na Edge Function.

### 2. Atualizar `whatsapp-webhook/index.ts`
Expandir a funcao para:
- Detectar quando o evento e uma **mensagem recebida** (text message from client)
- Extrair o texto e o telefone do remetente
- Buscar o cliente no banco pelo telefone (`ebd_clientes.telefone`)
- Buscar o tracking do funil (`funil_posv_tracking`)
- Montar contexto para a OpenAI:
  - Nome do cliente, fase atual, se ja fez login, se tem onboarding, etc.
  - System prompt com instrucoes sobre o sistema EBD e suas funcionalidades
- Chamar OpenAI API com tool calling para decidir a acao
- Executar a acao (enviar credenciais, responder duvida)
- Enviar resposta via Z-API
- Registrar em `whatsapp_mensagens`

### 3. Criar tabela `whatsapp_conversas` (opcional mas recomendado)
Para manter historico de conversa por telefone e alimentar contexto nas proximas interacoes:
- `id`, `telefone`, `cliente_id`, `role` (user/assistant), `content`, `created_at`

## Secao Tecnica

### Estrutura do payload Z-API (mensagem recebida)
A Z-API envia webhooks com eventos como:
- `event: "received"` ou `type: "ReceivedCallback"` para mensagens recebidas
- `text.message` contem o texto da mensagem
- `phone` ou `from` contem o telefone do remetente

### System Prompt da OpenAI
O agente tera um prompt detalhado sobre:
- As funcionalidades do sistema Gestao EBD (cadastro de turmas, escalas, frequencia, devocionais, quiz, ranking, etc.)
- Informacoes sobre o pedido e rastreio
- Instrucoes para identificar intencao e responder de forma comercial/amigavel
- Uso de tool calling para acoes estruturadas (enviar credenciais, responder duvida)

### Tools da OpenAI
```text
1. enviar_credenciais - Quando o cliente quer acesso ao sistema
   Parametros: nenhum (credenciais sao buscadas do banco)

2. responder_duvida - Quando o cliente tem pergunta sobre o sistema
   Parametros: resposta (string com a resposta)

3. resposta_generica - Para saudacoes ou mensagens nao relacionadas
   Parametros: resposta (string)
```

### Fluxo no codigo
```text
1. Receber webhook
2. Verificar se e mensagem recebida (text)
3. Buscar cliente por telefone
4. Se nao encontrar → resposta padrao ("Nao encontramos seu cadastro")
5. Se encontrar:
   a. Buscar tracking do funil
   b. Buscar ultimas mensagens da conversa (contexto)
   c. Montar mensagens para OpenAI (system + historico + mensagem atual)
   d. Chamar OpenAI com tools
   e. Executar tool escolhida
   f. Enviar resposta via Z-API
   g. Salvar conversa no banco
```

### Arquivo alterado: `supabase/functions/whatsapp-webhook/index.ts`
- Adicionar logica de deteccao de mensagem recebida
- Adicionar integracao com OpenAI
- Adicionar envio de resposta via Z-API
- Adicionar registro de conversa

### Novo recurso no banco: tabela `whatsapp_conversas`
```sql
CREATE TABLE whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefone TEXT NOT NULL,
  cliente_id UUID REFERENCES ebd_clientes(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tool_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_whatsapp_conversas_telefone ON whatsapp_conversas(telefone);
CREATE INDEX idx_whatsapp_conversas_created ON whatsapp_conversas(created_at DESC);
```

### Secret necessario
- `OPENAI_API_KEY` - **ja existe** nos secrets do projeto

### Config.toml
- `whatsapp-webhook` ja esta com `verify_jwt = false` (correto para webhook externo)
