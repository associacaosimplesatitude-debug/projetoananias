

## Diagnóstico: Logs de Envio Vazios no Drawer

### Problema encontrado

**WhatsApp**: A query busca pela coluna `telefone`, mas a coluna correta na tabela `whatsapp_mensagens` é **`telefone_destino`**. Isso faz a query falhar silenciosamente (erro 400) e retornar vazio. Confirmei que o registro do Rodrigo Mello existe: mensagem `revista_acesso_liberado` enviada às 13:02, status `enviado`.

**Email**: A query busca em `ebd_email_logs` por `destinatario = 'cabomello@yahoo.com.br'`, mas os emails de acesso à revista são enviados diretamente pela API do Resend dentro da edge function `revista-licencas-shopify-admin` (action `resend`) e pelo webhook Shopify — nenhum dos dois registra em `ebd_email_logs`. Essa tabela é usada apenas pelos templates EBD. Portanto, para emails de revista, não há log nessa tabela — isso é esperado.

### Correções

1. **Corrigir coluna WhatsApp** — Trocar `telefone` por `telefone_destino` na query do drawer (linha 403).

2. **Buscar emails no lugar certo** — Além de `ebd_email_logs`, também buscar na tabela de mensagens de campanha ou aceitar que emails de revista não têm log dedicado e mostrar nota explicativa adequada ("Emails de acesso à revista não são registrados no log de envios").

### Arquivos a alterar

- `src/pages/admin/RevistaLicencasAdmin.tsx` — corrigir nome da coluna na query de WhatsApp logs

