
Objetivo: corrigir a parada do disparo em 119 contatos e permitir que a campanha continue até concluir os 1090 sem depender de uma única execução longa.

Diagnóstico confirmado
- A campanha está com status `enviando`, 119 `enviado`, 971 `pendente`, `total_enviados = 0` e `total_erros = 0`.
- O último envio bem-sucedido ocorreu às `13:20:26`.
- A função `whatsapp-send-campaign` registrou `shutdown` às `13:20:27`.
- A função `disparar-campanha-revista` registrou `SyntaxError: Unexpected end of JSON input` ao tentar ler a resposta do envio.
- O payload enviado para a Meta está correto: header de imagem + body + button.
- Conclusão: o problema principal não é o template, e sim o modelo de execução. Hoje a função tenta processar todos os 1090 destinatários em uma única chamada HTTP e morre no meio. Quando isso acontece:
  - `disparar-campanha-revista` recebe resposta truncada/vazia e quebra no `sendRes.json()`
  - `whatsapp-send-campaign` não chega ao final, então não atualiza os totais da campanha

Plano de implementação
1. Tornar o disparo resiliente por lotes
- Alterar `whatsapp-send-campaign` para processar apenas um lote por execução, por exemplo 50 ou 100 destinatários `pendente`.
- Ao final do lote:
  - atualizar `total_enviados` e `total_erros` incrementalmente
  - verificar quantos `pendente` restam
  - se ainda houver pendentes, disparar a próxima execução automaticamente
  - se não houver, marcar a campanha como `enviada`

2. Parar de depender de uma resposta longa entre funções
- Alterar `disparar-campanha-revista` para apenas iniciar o processo e retornar rápido.
- Em vez de esperar o processamento inteiro terminar, ela deve responder algo como:
  - `started: true`
  - `pending_total`
  - `batch_size`
- Também corrigir o parsing da resposta para não usar `sendRes.json()` cegamente quando o body vier vazio ou inválido.

3. Preservar retomada sem duplicar envios
- Manter a busca sempre por `status_envio = 'pendente'`.
- Isso permite retomar exatamente dos 971 restantes, sem reenviar para os 119 já enviados.

4. Atualizar os contadores da campanha durante o processo
- Hoje os contadores só são gravados no fim; como a função morre antes, ficam zerados.
- A correção deve somar os resultados a cada lote e refletir progresso real na tela.

5. Melhorar feedback na tela admin
- Em `src/components/admin/WhatsAppCampaigns.tsx`, após iniciar o disparo:
  - mostrar mensagem de “processamento iniciado”
  - invalidar/refetch da lista periodicamente ou após cada retorno
  - exibir progresso com base em `enviado/erro/pendente`
- O problema dos botões não é a causa; a condição atual já está correta.

Arquivos a alterar
- `supabase/functions/whatsapp-send-campaign/index.ts`
- `supabase/functions/disparar-campanha-revista/index.ts`
- `src/components/admin/WhatsAppCampaigns.tsx` (apenas para feedback/progresso)

Fluxo proposto
```text
/admin/whatsapp
  -> disparar-campanha-revista
     -> inicia whatsapp-send-campaign (lote 1)
     -> responde imediatamente ao frontend

whatsapp-send-campaign
  -> busca próximos N pendentes
  -> envia
  -> atualiza contadores
  -> se restarem pendentes, chama novo lote
  -> se acabar, marca campanha como enviada
```

Detalhes técnicos
- Não precisa mudar banco nem criar tabelas.
- O header com imagem já está correto; não é onde o envio trava agora.
- Como o envio já filtra por `pendente`, após a correção será possível continuar esta mesma campanha existente sem resetar os 119 já enviados.
- Vou manter logs mais claros por lote:
  - lote iniciado
  - quantidade processada
  - enviados/erros acumulados
  - restantes
  - conclusão final

Resultado esperado
- A campanha deixa de parar em ~119.
- O frontend não mostra erro falso por JSON truncado.
- Os 971 pendentes restantes passam a ser processados em sequência, com progresso visível e sem duplicação.
