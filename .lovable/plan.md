## Objetivo
Fazer a aba **Conversas** em `/admin/whatsapp` exibir também as mensagens recebidas, alinhando o painel com o volume que já aparece na Meta Business.

## O que vou implementar
1. **Validar a origem da divergência entre Meta e painel**
   - Confirmar onde as mensagens recebidas estão sendo persistidas hoje.
   - Verificar se a ausência no chat vem de ingestão incompleta do webhook, filtro de leitura, ou correspondência incorreta de telefone.

2. **Corrigir a fonte de dados do chat**
   - Ajustar a lógica para que a conversa aberta carregue todas as mensagens recebidas realmente disponíveis para o número selecionado.
   - Garantir compatibilidade entre variantes do telefone (com/sem 55, com/sem 9º dígito) sem duplicar mensagens.

3. **Corrigir a lista lateral de conversas**
   - Fazer a sidebar refletir o último evento real da conversa, incluindo recebidas.
   - Preservar nomes/fotos já enriquecidos pelos webhooks e manter a ordenação por mensagem mais recente.

4. **Validar com o número de teste informado**
   - Conferir especificamente o fluxo do número `11947141878`.
   - Verificar se, ao abrir a conversa, as mensagens recebidas passam a aparecer junto das enviadas.

## Evidência já encontrada
- O frontend da conversa já consulta `whatsapp_conversas` para mensagens recebidas e `whatsapp_mensagens` para enviadas.
- Há mensagens recebidas no banco, mas o total salvo em `whatsapp_conversas` está abaixo do total de recebidas reportado nos webhooks/Meta, indicando que parte da divergência vem da ingestão.
- A UI atual também depende de correspondência por telefone, o que pode ocultar mensagens quando o mesmo contato entra com formatos diferentes.

## Detalhes técnicos
- Arquivos-alvo prováveis:
  - `src/components/admin/WhatsAppChat.tsx`
  - `supabase/functions/whatsapp-webhook/index.ts` (somente se a falha confirmada estiver na ingestão)
- Manterei o escopo restrito ao módulo de WhatsApp admin e ao webhook relacionado.
- Não vou alterar outras áreas administrativas nem fluxos não relacionados.

## Resultado esperado
Ao abrir uma conversa em `/admin/whatsapp`, o histórico exibirá mensagens **enviadas e recebidas**, em ordem cronológica, sem depender de o contato ter somente mensagens enviadas.