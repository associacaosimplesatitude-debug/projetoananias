# Correção: campanha "aviso advecs" caiu em status `erro`

## Diagnóstico

A campanha `aviso advecs` (id `a837230e…`) ficou marcada como **erro** com `total_publico = 0`, apesar do público "Clientes" ter 144 contatos calculados. A audiência está correta — a falha aconteceu na **materialização** disparada pelo cron.

### Causa raiz

O cron `whatsapp-cron-processar-campanhas` chama a RPC `whatsapp_campanha_materializar` usando **service role**. Essa RPC, por sua vez, faz `SELECT * FROM public.whatsapp_publico_materializar(...)` dentro de uma CTE.

A função `whatsapp_publico_materializar` tem este guard logo no início:

```sql
IF NOT public.has_role(auth.uid(), 'superadmin') THEN
  RAISE EXCEPTION 'Acesso negado: requer superadmin';
END IF;
```

Quando chamada via service role, `auth.uid()` é `NULL` → `has_role(NULL, 'superadmin')` devolve `false` → a função lança exceção. O `whatsapp_campanha_materializar` recebe o erro, o cron cai no branch `matErr` e atualiza o status para `erro`. Por isso `total_publico = 0` e nenhum destinatário foi gravado em `whatsapp_campanha_destinatarios`.

A RPC pai (`whatsapp_campanha_materializar`) já trata corretamente o caso de service role (`auth.uid() IS NULL OR has_role(... 'superadmin')`). A pai é `SECURITY DEFINER`, mas como o guard da função filha também checa `auth.uid()` (que continua NULL no contexto da sessão), o bloqueio acontece mesmo assim.

### Bug secundário relacionado (mesma origem, mesma fix)

O cron usa `SUPABASE_SERVICE_ROLE_KEY` como `Authorization: Bearer ...` ao invocar `whatsapp-send-campaign`. Isso viola a regra do projeto (memory) que proíbe service role como bearer. Não é o que travou esta campanha (nem chegou a ser chamada), mas vai estourar no próximo envio. Corrigir junto evita reabrir o mesmo bug.

## O que vai ser feito

### 1. Migration única — liberar service role na RPC filha

Atualizar `public.whatsapp_publico_materializar` para aceitar service role da mesma forma que a função pai:

```sql
IF NOT (
  auth.uid() IS NULL
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
) THEN
  RAISE EXCEPTION 'Acesso negado: requer superadmin';
END IF;
```

Sem mudar assinatura, sem alterar a lógica de filtros, sem mexer em `whatsapp_publico_contar` ou `whatsapp_publico_recalcular` (esses são chamados só pela UI com usuário autenticado, comportamento atual está certo).

### 2. Edge Function `whatsapp-cron-processar-campanhas`

- Trocar a invocação HTTP de `whatsapp-send-campaign` para usar o cliente Supabase com service role (`supabase.functions.invoke`) em vez de `fetch` com `Authorization: Bearer <service_role>`. Isso resolve o bug secundário sem mudar comportamento.
- Adicionar um log explícito do erro vindo da RPC (`matErr.message` já é logado — confirmar que está aparecendo nos logs de produção).

### 3. Recuperar a campanha "aviso advecs"

- Voltar o status de `erro` → `agendada` (ou `pronta` após re-materialização) para que o cron processe na próxima rodada.
- Isso pode ser feito por SQL pontual após a migration subir, sem precisar recriar a campanha.

## O que NÃO vai ser alterado

- View `whatsapp_contatos_360`, tabela `whatsapp_optouts`, função `normalizar_telefone_whatsapp`.
- Tabela `whatsapp_publicos` nem o motor de filtros (a contagem de 144 está correta).
- UI de campanhas, públicos, relatório de entrega.
- Tamanho de lote (50), endpoint Graph, cron schedule.

## Detalhes técnicos

- Migration: 1 arquivo com `CREATE OR REPLACE FUNCTION public.whatsapp_publico_materializar(...)` mantendo `STABLE SECURITY DEFINER SET search_path = public` e apenas trocando o bloco do guard.
- Edge function: substituir o `fetch(...send-campaign...)` por `await supabase.functions.invoke("whatsapp-send-campaign", { body: { campanha_id: c.id } })`. O client já está criado com service role no escopo do handler.
- Recuperação: `UPDATE whatsapp_campanhas SET status='agendada', agendada_para=now() WHERE id='a837230e-9ab8-4e53-9863-7ec66d66ff94';` — o próximo tick do cron (≤5 min) materializa e dispara.

## Validação após deploy

1. Forçar uma execução do cron (ou esperar 5 min).
2. Conferir em `whatsapp_campanhas`: `status` deve virar `pronta` → `processando` → `concluida` e `total_publico = 144`.
3. Conferir em `whatsapp_campanha_destinatarios`: 144 linhas com `campanha_id = a837230e…`.
4. Acompanhar o relatório de entrega em `/admin/campaign-tracking/a837230e-…`.
