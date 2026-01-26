
## Diagnóstico (o que está acontecendo de verdade)
Os logs da função mostram repetidamente:

- `[SQL] RPC error: Could not find the function public.execute_readonly_query(query_text) in the schema cache`

Isso indica que **a chamada RPC está sendo feita com um parâmetro nomeado incorreto**.

No seu banco, a função existente está definida como:
- `public.execute_readonly_query(sql_query text)`

Mas no código da Edge Function você está chamando assim:
- `supabase.rpc('execute_readonly_query', { query_text: query })`

Como o Supabase RPC usa **parâmetros nomeados**, ele procura uma assinatura compatível com `query_text` e não encontra — por isso o erro de “schema cache”. Resultado: o “execute_sql” falha, e o assistente responde algo genérico (“dificuldades técnicas”), ou pode estourar erro dependendo do fluxo.

## Objetivo
Fazer o assistente conseguir executar consultas (ex.: “QUANTO VENDI HOJE”) chamando corretamente a RPC `execute_readonly_query`.

---

## Mudanças planejadas (código)
### 1) Ajustar a chamada RPC para usar o nome certo do parâmetro
No arquivo:
- `supabase/functions/gemini-assistente-gestao/index.ts`

Atualizar a linha dentro de `executeSql()` de:
- `supabase.rpc('execute_readonly_query', { query_text: query })`

para:
- `supabase.rpc('execute_readonly_query', { sql_query: query })`

Isso alinha o código com a assinatura real do banco (`sql_query`).

### 2) Melhorar a mensagem de erro retornada ao modelo (opcional, mas recomendado)
Ainda em `executeSql()`, manter o log, mas também retornar uma mensagem mais orientada para “tente novamente” quando ocorrer falha de RPC, para evitar respostas genéricas.

---

## Validação (testes)
### 3) Testar a Edge Function diretamente (sem depender do UI)
Após a alteração do código, vou:
- chamar a função via ferramenta de teste (request POST) enviando `messages` com:
  - `"QUANTO VENDI HOJE"`

Confirmar que:
- não aparece mais o erro “Could not find the function … (query_text)”
- o modelo consegue acionar `execute_sql`
- a resposta final vem com o valor total do dia (formatado)

### 4) Testar no /admin/ebd com o chat
Repetir a pergunta:
- “QUANTO VENDI HOJE”

Confirmar que agora:
- ele consulta o banco
- responde em linguagem natural com total e data

---

## Possíveis próximos bloqueios (já deixo mapeado)
Se depois dessa correção o valor vier “0” ou “Nenhum resultado”, não será mais erro técnico — será:
1) **filtro de data/timezone** (ex.: “hoje” no UTC vs Brasil)
2) **tabela/status correto para “vendas”** (ex.: faturadas vs pagas vs propostas)
3) **dados realmente inexistentes no período**

Se ocorrer, o próximo passo será ajustar a query que o assistente tende a montar (ex.: usar `CURRENT_DATE` no timezone correto, ou filtrar por status “Atendido/Faturado” / “PAGO”).

---

## Entregáveis
- Correção no parâmetro do RPC (`sql_query`)
- Redeploy da função
- Teste via chamada direta + teste no chat do /admin/ebd
