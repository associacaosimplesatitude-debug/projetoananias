## Objetivo
Corrigir de forma definitiva o acesso do vendedor em `/vendedor/atendimento` e permitir que gerentes respondam mensagens no módulo de WhatsApp, sem reabrir o problema de RLS.

## O que vou implementar

### 1. Corrigir o backend que ainda está filtrando errado a timeline do vendedor
- Atualizar as policies de `whatsapp_conversas`, `whatsapp_mensagens` e `whatsapp_webhooks` que ainda usam a lógica antiga com `get_auth_email()` + `get_vendedor_id_by_email(...)`.
- Reescrever essas policies para usar `current_vendedor_id()` diretamente, igual ao ajuste correto já feito em `agente_ia_conversas`.
- Garantir reload de schema no backend após a migration.

### 2. Eliminar a causa do “entra mas não vê conversa”
- Ajustar a leitura do chat do vendedor para depender do mesmo critério seguro usado nas policies atuais.
- Verificar e, se necessário, alinhar a busca por telefones/variantes para não perder conversa por diferença entre `55...`, `11...` e `+55...`.
- Proteger explicitamente a rota `/vendedor/atendimento` com `VendedorProtectedRoute` para evitar montagem da tela em estado inconsistente.

### 3. Liberar gerente para responder mensagens
- Remover o bloqueio de “somente leitura” para `scope="gerente"` no `WhatsAppChat`.
- Permitir digitação, envio manual e uso do mesmo fluxo de `send-whatsapp-message` para gerente.
- Manter as restrições de negócio que já existem para encaminhamento/devolução, sem abrir poderes de superadmin para gerente.

### 4. Validar o envio do gerente no backend
- Confirmar que o envio pela Edge Function aceita gerente autenticado.
- Se houver bloqueio implícito no banco para registrar a mensagem enviada em `whatsapp_mensagens` ou espelhar em `whatsapp_conversas`, ajustar as regras no backend para `admin` e `gerente_ebd`.
- Preservar vendedor em modo restrito ao escopo que você definiu: ver apenas suas conversas atribuídas.

### 5. Verificação final
- Testar o cenário do vendedor: abrir `/vendedor/atendimento` e confirmar que as conversas atribuídas aparecem.
- Testar o cenário do gerente: abrir o atendimento, digitar e enviar mensagem.
- Confirmar por rede/logs que o erro deixou de ser 403 e que a lista não volta vazia indevidamente.

## Evidência encontrada
- O backend está saudável.
- A query de `agente_ia_conversas` já aparece como `200`, então o problema principal não parece mais estar nela.
- As policies de `whatsapp_conversas` e `whatsapp_mensagens` ainda estão antigas e continuam usando `get_auth_email()`/`get_vendedor_id_by_email(...)`.
- Isso explica por que o vendedor pode até passar da primeira filtragem, mas a timeline ainda falha ou some.
- O gerente hoje está bloqueado no próprio componente por condição de UI (`scope !== "superadmin"`), então mesmo autenticado não consegue responder.

## Detalhes técnicos
```text
Vendedor
  auth user
    -> current_vendedor_id()
      -> agente_ia_conversas (conversas atribuídas)
        -> whatsapp_conversas / whatsapp_mensagens / whatsapp_webhooks

Gerente
  role gerente_ebd
    -> pode listar conversas
    -> pode enviar via send-whatsapp-message
    -> não recebe poderes extras de superadmin
```

### Arquivos mais prováveis
- `supabase/migrations/...` (nova migration de RLS)
- `src/components/admin/WhatsAppChat.tsx`
- `src/App.tsx`
- `supabase/functions/send-whatsapp-message/index.ts` (somente se a validação mostrar necessidade)

### Resultado esperado
- Vendedor volta a ver suas conversas atribuídas.
- Gerente consegue responder mensagens normalmente.
- O acesso continua seguro, sem consulta direta vulnerável a `auth.users` dentro das policies erradas.