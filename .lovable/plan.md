
Diagnóstico correto do problema (com base no código + tráfego):
- O fluxo está preso porque a função retorna repetidamente `partial: true`, `done: false`, `next_page: 1`.
- No frontend, o loop `while (nextPage !== null)` continua chamando sempre `start_page: 1`.
- Isso gera ciclo infinito de busca e o botão fica em “Buscando página 1…”.
- Há também um bug de cursor no retorno final da função: após incrementar `page` no loop, ela retorna `next_page: page + 1`, o que pode pular páginas quando não há timeout.

Plano de implementação (focado em destravar sem perder dados):

1) Ajustar contrato de paginação da função para suportar progresso dentro da mesma página
- Arquivo: `supabase/functions/bling-search-campaign-audience/index.ts`
- Adicionar cursor de item de contato:
  - Request: `start_contact_index` (default 0)
  - Response: `next_contact_index`
- Quando estourar `MAX_EXECUTION_MS` durante `/contatos/{id}`:
  - retornar `next_page: page` (mesma página)
  - retornar `next_contact_index` com o índice exato de onde parar
  - manter `partial: true`, `done: false`
- Assim, a próxima chamada continua do ponto exato, sem reprocessar tudo da página.

2) Corrigir avanço de página e retorno de cursor
- Na função, corrigir cálculo de `next_page` para não pular página:
  - retornar o próximo valor real de `page` (sem `+1` extra no final)
- Garantir coerência:
  - se página terminou e ainda há mais: `next_page = page + 1`, `next_contact_index = 0`
  - se terminou tudo: `done = true`, `next_page = null`

3) Atualizar loop do frontend para usar os dois cursores
- Arquivo: `src/components/admin/WhatsAppCampaigns.tsx`
- Além de `nextPage`, controlar `nextContactIndex`.
- Enviar ambos no body (`start_page`, `start_contact_index`).
- Ler ambos da resposta.
- Atualizar progresso no botão com página + posição para transparência.

4) Adicionar proteção anti-loop no frontend (fail-safe)
- Se o backend devolver o mesmo par (`next_page`, `next_contact_index`) por N iterações consecutivas sem novos contatos:
  - interromper o loop
  - mostrar erro claro (“busca sem progresso, interrompida para segurança”)
- Isso evita travamento infinito mesmo em cenários inesperados.

5) Manter diagnóstico detalhado já existente
- Preservar logs:
  - token parcial
  - parâmetros da requisição
  - erro completo do Bling (`status`, `url`, `body`)
- Acrescentar log do cursor (`page`, `contact_index`) para rastrear retomadas.

Detalhes técnicos (resumo):
- Problema principal: cursor incompleto (apenas página) + timeout no meio do processamento por contato.
- Solução técnica: cursor composto (`page` + `contact_index`) com retomada determinística.
- Benefício: elimina ciclo infinito, evita reprocessamento caro, mantém cobertura completa dos destinatários.

Validação após implementação:
1. Executar busca no mesmo filtro que trava hoje.
2. Confirmar no network que `start_contact_index` evolui entre chamadas.
3. Confirmar que o botão sai de “Buscando...” e termina com sucesso.
4. Confirmar que `done: true` chega ao final e que a contagem de destinatários cresce até estabilizar.
5. Confirmar ausência de repetição infinita de requests idênticos.
