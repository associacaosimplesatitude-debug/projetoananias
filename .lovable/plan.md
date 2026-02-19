
# Corrigir Recebimento de Imagens no Chat WhatsApp

## Problema
Quando alguem envia uma imagem pelo WhatsApp, o payload da Z-API vem com a estrutura `payload.image.imageUrl` e `payload.image.caption` em vez de `payload.text.message`. A funcao `extractMessageText` nao reconhece esse formato, retorna `null`, e a mensagem nunca e salva.

## Solucao em 3 partes

### 1. Adicionar coluna `imagem_url` na tabela `whatsapp_conversas`
- Migracao SQL: `ALTER TABLE whatsapp_conversas ADD COLUMN imagem_url text;`
- Permite armazenar a URL da imagem junto com a mensagem recebida

### 2. Atualizar o webhook para detectar e salvar imagens
No arquivo `supabase/functions/whatsapp-webhook/index.ts`:

- Criar funcao `extractImageUrl(payload)` que busca em `payload.image.imageUrl`
- Atualizar `extractMessageText` para tambem buscar `payload.image.caption` (legenda da imagem)
- No bloco principal, salvar `imagem_url` junto com o content na tabela `whatsapp_conversas`
- Tratar caso onde so tem imagem sem legenda (salvar content como "[Imagem]" e a URL)

### 3. Atualizar o componente de chat para exibir imagens de `whatsapp_conversas`
No arquivo `src/components/admin/WhatsAppChat.tsx`:

- Na query de mensagens, incluir `imagem_url` ao buscar de `whatsapp_conversas`
- Passar a `imagemUrl` para o `ChatMessage` quando vier de `whatsapp_conversas`
- O `MessageBubble` ja tem suporte a renderizar imagens (campo `imagemUrl`), entao so precisa mapear

## Detalhes tecnicos

### Migracao SQL
```text
ALTER TABLE public.whatsapp_conversas ADD COLUMN imagem_url text;
```

### Nova funcao no webhook
```text
function extractImageUrl(payload):
  if payload.image?.imageUrl -> return imageUrl
  if payload.image?.thumbnailUrl -> return thumbnailUrl
  return null

Atualizar extractMessageText para incluir:
  if payload.image?.caption -> return caption
```

### Fluxo atualizado do webhook
```text
1. Extrair messageText (texto OU caption da imagem)
2. Extrair imageUrl da imagem
3. Se tem messageText OU imageUrl:
   - Salvar em whatsapp_conversas com content e imagem_url
4. Processar com IA se ativo
```

### Mudanca na query do chat
Na funcao que busca mensagens de `whatsapp_conversas`, incluir o campo `imagem_url` no select e mapear para `imagemUrl` no objeto `ChatMessage`.
