
# Adicionar Suporte a Audio no Chat WhatsApp

## Problema
O webhook nao reconhece mensagens de audio da Z-API. O payload de audio vem com a estrutura `payload.audio.audioUrl` (similar ao `payload.image.imageUrl`), mas nenhuma funcao no webhook trata esse formato.

## Solucao

### 1. Migracao de banco
Adicionar coluna `audio_url` na tabela `whatsapp_conversas` para armazenar a URL do audio recebido.

```text
ALTER TABLE public.whatsapp_conversas ADD COLUMN audio_url text;
```

### 2. Atualizar o webhook (`supabase/functions/whatsapp-webhook/index.ts`)

- **`isReceivedMessage`**: Adicionar deteccao de `payload.audio` (audioUrl)
- **Nova funcao `extractAudioUrl`**: Extrair `payload.audio.audioUrl` ou `payload.audio.url`
- **Bloco principal**: Salvar `audio_url` em `whatsapp_conversas` com content `[Audio]` quando nao houver texto
- **IA**: Nao processar audios com OpenAI (similar a imagens)

### 3. Atualizar o chat UI (`src/components/admin/WhatsAppChat.tsx`)

- Incluir `audio_url` no select de `whatsapp_conversas`
- Adicionar campo `audioUrl` ao tipo `ChatMessage`
- No `MessageBubble`, renderizar um player de audio (`<audio>` HTML) quando `audioUrl` estiver presente

### Fluxo final
```text
Mensagem de audio recebida -> webhook detecta payload.audio
-> Salva em whatsapp_conversas (content: "[Audio]", audio_url: URL)
-> Chat exibe player de audio no balao da mensagem
```
