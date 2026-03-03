
Diagnóstico confirmado (com evidência):
- O erro não é mais só CORS. Há falhas intermitentes de gateway na função:
  - `OPTIONS 502/504` e `POST 502` para `bling-search-campaign-audience` (logs de analytics), com `function_id` nulo em parte das falhas.
  - Também existem chamadas `POST 200`, ou seja: comportamento instável (ora responde, ora cai).
- No front, a chamada está correta (`supabase.functions.invoke` com body válido e token).
- A função atual ainda pode ficar longa para intervalos com muitos pedidos (loop sem limite de páginas), o que aumenta chance de timeout/502.

Plano de correção (implementação):

1) Endurecer a Edge Function para estabilidade de runtime
- Arquivo: `supabase/functions/bling-search-campaign-audience/index.ts`
- Trocar import de `@supabase/supabase-js` de `esm.sh` para `npm:@supabase/supabase-js@2` (mesmo padrão das funções estáveis do projeto).
- Manter CORS atual e padronizar preflight para resposta imediata consistente.
- Adicionar timeout defensivo por execução (ex.: `MAX_EXECUTION_MS`) e limite de páginas por chamada (ex.: `MAX_PAGES_PER_CALL`), retornando payload parcial com:
  - `contacts`
  - `next_page` (ou `null`)
  - `done` (boolean)
  - `partial` (boolean)
- Continuar deduplicação por telefone normalmente dentro de cada chamada.

2) Transformar busca em paginação incremental no front (sem estourar gateway)
- Arquivo: `src/components/admin/WhatsAppCampaigns.tsx`
- Em vez de 1 chamada longa:
  - loop de chamadas curtas para a função (ex.: blocos de 3–5 páginas por request),
  - merge/deduplicação no cliente,
  - progress feedback para usuário (“Buscando página X…”).
- Encerrar quando `done=true`.
- Se receber resposta parcial por limite de execução, continuar automaticamente da `next_page`.
- Resultado: elimina requisição única longa (principal causa prática de “Failed to send request to the Edge Function”).

3) Resiliência de UX
- Melhorar mensagem de erro de segmentação:
  - distinguir “falha transitória de conexão” de “erro de regra/dados”.
  - botão de “tentar novamente do ponto onde parou” usando `next_page`.
- Manter canais fixos no front (já aplicado) para não depender de chamada extra.

4) Verificação após implementação
- Teste real no `/admin/whatsapp` com o mesmo intervalo que falhava (nov/2025).
- Confirmar no network:
  - múltiplos POST curtos com status 200,
  - ausência de POST único longo.
- Confirmar no backend:
  - sem novos 502/504 para esse fluxo durante a segmentação.
- Validar que a lista final de destinatários aparece e segue para criação da campanha sem erro.

Impacto esperado:
- Remove instabilidade percebida pelo usuário (“continua com problema”).
- Busca de público deixa de depender de uma chamada longa suscetível a timeout/gateway.
- Fluxo fica previsível mesmo com alto volume de pedidos.
