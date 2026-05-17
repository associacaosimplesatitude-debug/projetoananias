## Diagnóstico

Os pontos do aluno aparecem zerados quando ele tem **mais de uma licença** comprada com **identificadores diferentes** (telefone em uma compra e e-mail como fallback em outra — caso real: "Centro Assistencial Simples Atitude" tem licenças com `whatsapp = 11947141878` e outras com `whatsapp = cleuton.soares@gmail.com`).

A função `buscar-pontos-leitor` consulta `revista_ranking_publico` filtrando **exatamente** pelo `whatsapp` da sessão atual. Se a sessão entrou via e-mail mas os quizzes foram respondidos sob o telefone (ou vice-versa), retorna 0 — mesmo havendo pontos salvos no banco para o mesmo comprador.

No caso real verificado: existem 3 respostas de quiz totalizando **100 pts** salvas sob `11947141878`, mas a sessão atual usa `cleuton.soares@gmail.com`, então o card mostra 0.

## Correção

Atualizar a edge function `supabase/functions/buscar-pontos-leitor/index.ts` para **unificar todos os identificadores do mesmo comprador** antes de somar:

1. Receber o `whatsapp` da sessão (como hoje).
2. Buscar em `revista_licencas_shopify` o `email` associado a esse identificador.
3. Coletar todos os `whatsapp` distintos das licenças que compartilham o mesmo `email` (case-insensitive, trim).
4. Incluir o próprio identificador da sessão no conjunto, como segurança.
5. Somar `total_pontos` e `total_quizzes` em `revista_ranking_publico` usando `.in("whatsapp", [...identificadores])`.
6. Manter retorno `{ total_pontos, total_quizzes }` — nenhum cliente precisa mudar.

Sem alterações de schema, sem mudanças no `salvar-quiz-publico` (quizzes continuam sendo gravados sob o identificador da sessão), sem mexer na lista de ranking público (que continua segmentada por revista). Apenas o cartão "Seus Pontos" do leitor passa a refletir o total real do comprador.

## Arquivos alterados

- `supabase/functions/buscar-pontos-leitor/index.ts` — adicionar lookup por e-mail e somar todos os identificadores.
