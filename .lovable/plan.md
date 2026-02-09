
# Painel de Envio de Mensagens WhatsApp via Z-API

## Visao Geral

Criar um painel administrativo completo para envio de mensagens via WhatsApp usando a Z-API. O painel ficara em `/admin/ebd/whatsapp` e permitira envio de mensagens de texto e imagens para contatos do sistema EBD.

## Tipos de Mensagens Suportadas

1. **Pedido Aprovado** - Notificar cliente que o pedido foi aprovado
2. **Dados de Acesso** - Enviar login/senha do sistema EBD
3. **Codigo de Rastreio** - Informar rastreio da encomenda
4. **Cupom de Desconto** - Enviar cupons promocionais
5. **Promocoes** - Divulgar ofertas e promocoes
6. **Lembrete de Aula** - Lembrar sobre aulas da EBD
7. **Agenda de Aulas** - Compartilhar cronograma de aulas

## Arquitetura

```text
+------------------+       +---------------------+       +----------+
| Painel WhatsApp  | ----> | Edge Function       | ----> | Z-API    |
| (React)          |       | send-whatsapp-msg   |       | WhatsApp |
+------------------+       +---------------------+       +----------+
```

## Segredos Necessarios

A Z-API requer 3 credenciais:
- **ZAPI_INSTANCE_ID** - ID da instancia
- **ZAPI_TOKEN** - Token da instancia  
- **ZAPI_CLIENT_TOKEN** - Token de seguranca da conta

Esses segredos serao solicitados ao usuario antes de prosseguir com a implementacao.

## Alteracoes Planejadas

### 1. Banco de Dados - Nova tabela `whatsapp_mensagens`

Tabela para registrar historico de mensagens enviadas:

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid | PK |
| tipo_mensagem | text | Tipo (pedido_aprovado, dados_acesso, rastreio, cupom, promocao, lembrete_aula, agenda_aulas) |
| telefone_destino | text | Numero do destinatario |
| nome_destino | text | Nome do destinatario |
| mensagem | text | Conteudo da mensagem |
| imagem_url | text (nullable) | URL publica da imagem enviada |
| status | text | enviado, erro, pendente |
| erro_detalhes | text (nullable) | Detalhes do erro se houver |
| enviado_por | uuid | FK para auth.users |
| created_at | timestamptz | Data de envio |

RLS: Apenas admins podem ler/inserir.

### 2. Edge Function - `send-whatsapp-message`

Funcao backend que:
- Recebe tipo, telefone, mensagem e opcionalmente imagem_url
- Envia via Z-API (`/send-text` ou `/send-image`)
- Registra na tabela `whatsapp_mensagens`
- Retorna status do envio

Endpoints Z-API utilizados:
- **Texto**: `POST https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-text`
- **Imagem**: `POST https://api.z-api.io/instances/{ID}/token/{TOKEN}/send-image`

### 3. Pagina - `src/pages/admin/WhatsAppPanel.tsx`

Interface com:
- **Selecao de tipo de mensagem** (dropdown com os 7 tipos)
- **Campo telefone** com formato brasileiro
- **Campo nome do destinatario**
- **Textarea para mensagem** com template pre-preenchido conforme o tipo selecionado
- **Campo URL da imagem** (opcional, para envio com imagem)
- **Botao enviar**
- **Tabela de historico** com mensagens ja enviadas (ultimas 50)
- **Indicadores** de status (enviado/erro)

Templates pre-definidos por tipo:
- Pedido Aprovado: "Ola {nome}! Seu pedido foi aprovado..."
- Dados de Acesso: "Ola {nome}! Seguem seus dados de acesso..."
- Codigo de Rastreio: "Ola {nome}! Seu pedido foi enviado. Rastreio: {codigo}..."
- etc.

### 4. Rota - Adicionar ao App.tsx

Nova rota: `/admin/ebd/whatsapp` -> `WhatsAppPanel`

### 5. Link no Painel Admin

Adicionar card/link para o painel WhatsApp na navegacao do admin EBD.

## Ordem de Implementacao

1. Solicitar os 3 segredos da Z-API ao usuario
2. Criar a tabela no banco (migracao)
3. Criar a edge function `send-whatsapp-message`
4. Criar a pagina `WhatsAppPanel.tsx`
5. Adicionar rota no `App.tsx`
6. Adicionar link de acesso no painel admin

## Detalhes Tecnicos

- A edge function usara `Deno.env.get()` para acessar os segredos
- CORS headers incluidos na edge function
- Validacao de telefone no formato brasileiro (55 + DDD + numero)
- Historico de mensagens com paginacao simples (ultimas 50)
- Toast de feedback apos envio
