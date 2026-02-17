

# Correcao: Trocar buttonActions por texto simples com link

## Problema
O endpoint `/send-button-actions` da Z-API aceita o payload mas nao entrega a mensagem ao destinatario. Mensagens de texto simples (`/send-text`) funcionam normalmente.

## Solucao
Remover o uso de `buttonActions` e `/send-button-actions` em todos os locais. Incorporar o link diretamente no texto da mensagem.

## Alteracoes

### 1. send-whatsapp-message/index.ts
- Remover a condicao `if (buttonActions)` (linhas 88-90)
- Manter apenas as opcoes `/send-text` e `/send-image`
- Se `buttonActions` for enviado no body, ignorar e usar texto simples

### 2. ebd-shopify-order-webhook/index.ts (linhas 748-775)
- Adicionar o link do tracker diretamente no texto da `fase1Msg`, ex:
  `Acompanhe seu pedido aqui: LINK`
- Usar endpoint `/send-text` em vez de `/send-button-actions`
- Remover `title`, `footer`, `buttonActions` do payload

### 3. whatsapp-link-tracker/index.ts (linhas 89-113)
- Na Mensagem 2 (credenciais), colocar o link do painel no texto
- Usar `/send-text` em vez de `/send-button-actions`
- Remover `title`, `footer`, `buttonActions` do payload

### 4. Teste
- Reenviar a Mensagem 1 para 5511986216465 como texto simples com link embutido

## Secao Tecnica

Payload antes (nao funciona):
```text
POST /send-button-actions
{ phone, message, title, footer, buttonActions: [...] }
```

Payload depois (funciona):
```text
POST /send-text
{ phone, message: "...texto...\n\nLink: https://..." }
```
