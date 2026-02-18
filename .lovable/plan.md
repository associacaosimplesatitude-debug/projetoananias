
# Desligar Agente de IA junto com Envio Automatico

## O que sera feito
Quando o switch "Envio Automatico de WhatsApp" estiver desligado (`whatsapp_auto_envio_ativo = false`), o agente de IA tambem deixara de responder mensagens recebidas. Ou seja, o webhook continuara registrando os eventos normalmente na tabela `whatsapp_webhooks`, mas nao processara nem respondera mensagens.

## Como funciona hoje
- O webhook `whatsapp-webhook` recebe TODAS as mensagens e sempre processa via IA
- A flag `whatsapp_auto_envio_ativo` so e verificada pelo `funil-posv-cron` e pelo `ebd-shopify-order-webhook`
- Resultado: mesmo com envio automatico desligado, o agente responde

## O que vai mudar

No arquivo `supabase/functions/whatsapp-webhook/index.ts`, antes de chamar `processIncomingMessage`, sera adicionada uma consulta a `system_settings` para verificar se `whatsapp_auto_envio_ativo` esta como `"false"`. Se estiver desligado:
- O webhook ainda registra o evento no `whatsapp_webhooks` (para nao perder dados)
- Mas NAO processa a mensagem com a IA e NAO responde ao cliente
- Um log sera emitido: "Agente de IA desativado - envio automatico desligado"

## Secao Tecnica

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**Bloco alterado (linhas 211-220)** - Adicionar verificacao da flag antes de processar:

```typescript
// Check if this is a received text message
if (isReceivedMessage(payload)) {
  // Verificar se o agente está ativo
  const { data: autoEnvioSetting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "whatsapp_auto_envio_ativo")
    .maybeSingle();

  if (autoEnvioSetting?.value === "false") {
    console.log("Agente de IA desativado - envio automático desligado");
    // Não processa, mas o webhook já foi registrado acima
  } else {
    const messageText = extractMessageText(payload);
    const senderPhone = extractPhone(payload);

    if (messageText && senderPhone) {
      console.log(`Received message from ${senderPhone}: ${messageText}`);
      await processIncomingMessage(supabase, senderPhone, messageText);
    }
  }
}
```

### Nenhuma alteracao no painel
O switch existente no painel WhatsApp (`/admin/ebd/whatsapp`) ja controla a flag. Nao e necessario adicionar novo componente -- o mesmo switch passa a controlar tanto o envio proativo quanto o agente de IA.

### Deploy
A edge function `whatsapp-webhook` sera redeployada apos a alteracao.
