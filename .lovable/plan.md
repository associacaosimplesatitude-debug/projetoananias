
# Corrigir Mensagens Recebidas no Chat WhatsApp

## Problema Identificado
Quando o Agente de IA esta desativado, o webhook recebe as mensagens normalmente (os `ReceivedCallback` estao chegando no `whatsapp_webhooks`), porem o codigo pula completamente o bloco que salva a mensagem na tabela `whatsapp_conversas`. Como o chat le mensagens recebidas dessa tabela, elas nunca aparecem no painel.

O trecho problematico no webhook:
```text
if (agenteIaSetting?.value !== "true") {
  console.log("Agente de IA desativado");  // <-- para aqui, nao salva nada
} else {
  // ... extrai mensagem, salva em whatsapp_conversas, processa com IA
}
```

## Solucao

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

Reestruturar o bloco para **SEMPRE** salvar a mensagem recebida em `whatsapp_conversas`, independente do estado do Agente de IA. A flag do agente deve controlar apenas se a mensagem sera processada pela OpenAI e respondida.

Novo fluxo:

```text
if (isReceivedMessage(payload)) {
  1. Extrair texto e telefone do payload
  2. Salvar mensagem em whatsapp_conversas (role: "user")  -- SEMPRE
  3. Verificar flag whatsapp_agente_ia_ativo
     - Se ativo: processar com OpenAI e responder
     - Se desativado: apenas logar, mensagem ja foi salva
}
```

### Detalhes tecnicos da mudanca

Mover a extracao de `messageText` e `senderPhone` para ANTES da verificacao do agente, e inserir o save em `whatsapp_conversas` tambem antes. O `processIncomingMessage` sera ajustado para nao duplicar o insert do user message (ja que sera feito antes).

Alternativamente, criar um bloco separado que salva a mensagem e depois chama `processIncomingMessage` apenas se o agente estiver ativo.

Nenhuma migracao de banco necessaria - so alteracao na Edge Function.
