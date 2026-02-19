

# Chat WhatsApp Profissional - Estilo WhatsApp Web

## Resumo
Criar uma nova aba "Conversas" no painel WhatsApp admin com interface profissional de chat inspirada no WhatsApp Web, com lista de contatos na lateral e janela de conversa na area central.

## Fontes de Dados

As conversas serao montadas combinando 3 tabelas existentes:

- **whatsapp_conversas**: historico de mensagens (role: user/assistant) por telefone - mensagens recebidas e respostas do agente IA
- **whatsapp_mensagens**: mensagens enviadas pelo sistema (funil, manuais) - com nome_destino e telefone_destino
- **whatsapp_webhooks**: payloads recebidos com foto e nome do contato (campo `payload->senderName`, `payload->photo`)

## Arquitetura

### Novo componente: `src/components/admin/WhatsAppChat.tsx`
Componente principal que sera adicionado como nova aba "Conversas" no WhatsAppPanel.

### Layout (Desktop)
```text
+----------------------------+--------------------------------------------+
|   Lista de Conversas       |   Cabecalho: Nome + foto + status          |
|   (w-80, lateral)          |--------------------------------------------+
|                            |                                            |
|   [foto] Nome              |   Balao cinza (recebida)                   |
|   Ultima mensagem...       |              Balao verde (enviada)         |
|   Badge: 3 nao lidas       |                                            |
|                            |   Balao cinza (recebida)                   |
|   [foto] Nome              |              Balao verde (enviada)         |
|   Ultima mensagem...       |                                            |
|                            |--------------------------------------------+
|   Busca por nome/telefone  |   [Input de mensagem]          [Enviar]    |
+----------------------------+--------------------------------------------+
```

### Layout (Mobile)
- Mostra apenas a lista de conversas
- Ao clicar em uma conversa, navega para a janela de chat (com botao voltar)

## Detalhes da Implementacao

### 1. Lista de Conversas (Lateral Esquerda)
- Buscar telefones unicos de `whatsapp_conversas` e `whatsapp_mensagens`
- Para cada telefone, buscar nome e foto do webhook mais recente (`ReceivedCallback`)
- Ordenar por data da ultima mensagem (mais recente primeiro)
- Campo de busca por nome ou telefone
- Badge de mensagens nao lidas (mensagens recebidas apos a ultima visualizacao)

### 2. Janela de Chat (Area Central)
- Cabecalho com foto, nome e telefone do contato
- Historico de mensagens unificado:
  - De `whatsapp_conversas` (role: user = recebida, role: assistant = enviada pelo agente)
  - De `whatsapp_mensagens` (enviadas pelo sistema/manual)
- Baloes de mensagem:
  - Recebidas: alinhadas a esquerda, fundo cinza claro
  - Enviadas: alinhadas a direita, fundo verde (estilo WhatsApp)
- Timestamps em cada mensagem
- Suporte a imagens (exibir inline quando `imagem_url` presente)
- Campo de input na parte inferior com botao de envio (usa a edge function `send-whatsapp-message` existente)

### 3. Responsividade
- Desktop: layout side-by-side com ResizablePanelGroup
- Mobile (< 768px): estados alternados - lista OU chat, com botao voltar

### 4. Funcionalidades
- Envio de texto pelo input (chama `send-whatsapp-message`)
- Visualizacao de imagens inline nos baloes
- Indicador de audio (link para ouvir quando o tipo for audio)
- Auto-scroll para ultima mensagem
- Refetch periodico a cada 10 segundos para novas mensagens

## Secao Tecnica

### Arquivos a criar:
- `src/components/admin/WhatsAppChat.tsx` - Componente principal do chat

### Arquivos a modificar:
- `src/pages/admin/WhatsAppPanel.tsx` - Adicionar nova aba "Conversas" com o componente WhatsAppChat

### Consultas ao banco:
1. **Lista de contatos**: Query unificada buscando telefones distintos de ambas tabelas, com nome/foto do webhook
2. **Mensagens de um contato**: Buscar de `whatsapp_conversas` + `whatsapp_mensagens` filtrado pelo telefone, ordenado por data
3. **Info do contato**: Buscar de `whatsapp_webhooks` WHERE evento = 'ReceivedCallback' AND telefone = X, para pegar foto e nome

### Componentes UI utilizados:
- ScrollArea (scroll do historico)
- Avatar/AvatarImage/AvatarFallback (fotos dos contatos)
- Input (campo de mensagem e busca)
- Button (enviar)
- Badge (nao lidas)
- ResizablePanelGroup/ResizablePanel/ResizableHandle (layout desktop)
- useIsMobile hook (responsividade)

### Nao e necessaria migracao de banco - todas as tabelas e dados ja existem.
