
Diagnóstico confirmado

- A campanha correta é `Campanha Escolha Versão — Compradores Revistas`.
- Ela não está zerada: chegou a avançar até `719 enviados`, `371 pendentes`, `0 erros`.
- O último envio registrado foi às `13:55:30`, e a campanha não andou depois disso.
- Há um descompasso de contagem: na tabela da campanha `total_enviados = 600`, mas nos destinatários já existem `719` marcados como `enviado`.

Motivo mais provável da parada

1. A função `whatsapp-send-campaign` ainda depende de encadeamento frágil entre execuções.
   - No fim de cada lote, ela chama a si mesma com `fetch(...)` em modo fire-and-forget.
   - Como não usa um mecanismo durável de continuação, a runtime pode encerrar antes de o próximo lote realmente ser garantido.
   - Isso explica o comportamento: vários lotes andam e, em algum ponto, a corrente quebra e a campanha para.

2. Os contadores da campanha não são confiáveis hoje.
   - O código faz leitura do total atual + soma do lote + update.
   - Se houver sobreposição, atraso ou interrupção entre lotes, os totais podem ficar divergentes do estado real dos destinatários.

3. Há dois caminhos de disparo no frontend.
   - Na lista, o botão usa `disparar-campanha-revista`.
   - Na visão de funil, ainda existe botão chamando `whatsapp-send-campaign` diretamente.
   - Isso mantém dois fluxos diferentes para a mesma ação e aumenta a chance de comportamento inconsistente.

Plano de correção

1. Unificar o disparo
- Fazer toda a interface usar apenas `disparar-campanha-revista` como ponto de entrada.
- Remover o disparo direto para `whatsapp-send-campaign` na tela de funil.

2. Tornar o processamento realmente assíncrono e durável
- Refatorar `whatsapp-send-campaign` para processar um lote por execução sem depender de uma resposta longa.
- Iniciar o lote em background com um padrão estável de continuação, para que a próxima execução não se perca quando a runtime encerrar a resposta atual.

3. Evitar parada silenciosa entre lotes
- Garantir continuação explícita do próximo lote com mecanismo seguro.
- Se o lote seguinte não for iniciado, registrar erro/estado de pausa em vez de deixar a campanha eternamente em `enviando`.

4. Corrigir os contadores
- Parar de usar apenas “somar ao total atual”.
- Recalcular `total_enviados` e `total_erros` a partir dos destinatários, ou usar atualização mais segura por lote.
- Isso corrige a diferença atual `600 x 719`.

5. Melhorar observabilidade
- Registrar por lote: início, quantidade processada, restante, falha e conclusão.
- Atualizar a UI para detectar campanha “travada” quando ficar muito tempo em `enviando` sem novos envios.

Arquivos a alterar

- `supabase/functions/whatsapp-send-campaign/index.ts`
- `supabase/functions/disparar-campanha-revista/index.ts`
- `src/components/admin/WhatsAppCampaigns.tsx`

Resultado esperado

- A campanha deixa de parar aleatoriamente no meio.
- O sistema continua dos `371 pendentes` sem reenviar os `719` já enviados.
- Os totais exibidos passam a bater com os destinatários reais.
- O painel deixa claro quando a campanha está processando, concluída ou travada.
