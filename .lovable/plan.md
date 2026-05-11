## Diagnóstico

O botão "Enviar template" no chat do WhatsApp falha com `Failed to send a request to the Edge Function`. 

Causa: a Edge Function `whatsapp-send-template-avulso` foi criada no código (`supabase/functions/whatsapp-send-template-avulso/index.ts`) mas **nunca foi deployada** no ambiente. Os logs da função estão vazios — confirma que ela nunca recebeu uma única requisição. O frontend chama via `supabase.functions.invoke("whatsapp-send-template-avulso", ...)` e bate em 404, que o cliente Supabase reporta como "Failed to send a request".

## Ação

1. Fazer deploy da função `whatsapp-send-template-avulso` usando a ferramenta de deploy.
2. Testar reabrindo o dialog de template e enviando para o mesmo lead (`11947141878` — Cleuton) com o template `revistas_digitais_oferta_6`.
3. Conferir os logs da função após o envio para garantir que processou e que a chamada ao Meta Graph API retornou sucesso.
4. Validar no banco que foi gravado um registro em `whatsapp_mensagens` com `tipo = 'template_avulso'` para esse telefone.

Se o deploy passar mas o envio retornar erro de payload (ex: variável faltando, número de phone_number_id não configurado em `system_settings`), corrijo conforme o erro específico aparecer nos logs.

## Restrições

- Não vou alterar `WhatsAppChat.tsx`, `TemplatePickerDialog.tsx`, nem o código da função em si nesse primeiro passo — quero confirmar primeiro se o deploy isolado já resolve.
- Apenas se os logs após o deploy mostrarem erro real de execução é que vou ajustar o código.