

## Problema

A aba "Webhooks" em `/admin/whatsapp` exibe a descrição "Últimos 100 eventos recebidos da Z-API" mas o sistema ja migrou para a API Oficial Meta. Os dados na tabela `whatsapp_webhooks` ja contêm eventos da Meta (formato `whatsapp_business_account`), então basta atualizar os textos e melhorar a exibição para refletir o formato Meta.

## Solução

**Arquivo: `src/pages/admin/WhatsAppPanel.tsx`** (function `WebhooksTab`, linhas 608-679)

1. Atualizar `CardDescription` de "Z-API" para "API Oficial Meta"
2. Adicionar coluna "Remetente" extraindo o nome do contato do payload Meta (`payload.entry[0].changes[0].value.contacts[0].profile.name`)
3. Adicionar coluna "Conteúdo" extraindo o texto da mensagem (`payload.entry[0].changes[0].value.messages[0].text.body`)
4. Manter a expansão do payload completo ao clicar na linha
5. Atualizar label do JsonBlock de "📋 Payload Completo" para "📋 Payload Meta"

