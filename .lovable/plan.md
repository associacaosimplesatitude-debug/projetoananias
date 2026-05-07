## Causa raiz

Quando o cliente clica "Quero ver as novidades", o webhook recebe o evento (logs confirmam: `[Meta] Received from 5511947141878: Quero ver as novidades`), mas a função `processarRespostaRetencao` não consegue **encontrar o cliente** no banco. Isso impede a gravação em `ebd_retencao_contatos` e `retencao_respostas`, então o card nunca aparece em "Interessado".

**Por quê?** Em `supabase/functions/whatsapp-webhook/index.ts` (linhas ~263-271), o lookup usa `.maybeSingle()`:

```ts
.from("ebd_clientes")
.select(...)
.or(`telefone.ilike.%${sf}`)
.limit(1)
.maybeSingle()
```

PostgREST/`maybeSingle` **retorna erro quando há mais de uma linha** com o mesmo número (mesmo com `.limit(1)`, o erro acontece antes do limit em alguns casos, e quando o telefone repete em vários clientes — o que é a regra aqui, ex.: `5511947141878` aparece em 10+ registros — `data` volta `null` e o cliente é tratado como inexistente).

Confirmação no banco: `retencao_respostas` está **vazia** e nenhum registro novo de `ebd_retencao_contatos` foi criado para esses cliques recentes — apesar de várias mensagens "Quero ver as novidades" terem chegado nos webhooks.

## Correção

Em `supabase/functions/whatsapp-webhook/index.ts`, dentro de `processarRespostaRetencao`, trocar o lookup para usar `.limit(1)` + array (sem `maybeSingle`), pegando a primeira linha:

```ts
for (const sf of sufs) {
  const { data } = await supabase
    .from("ebd_clientes")
    .select("id, vendedor_id, nome_igreja, email_superintendente, telefone")
    .or(`telefone.ilike.%${sf}`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) { cliente = data[0] as any; break; }
}
```

Aplicar a mesma correção no lookup de `clienteId` em `handleMetaPost` (linhas ~452-463), que também usa `.single()` e falha silenciosamente em telefones duplicados.

## Backfill dos cliques perdidos

Após o fix, rodar um backfill que:

1. Lê `whatsapp_webhooks` dos últimos 14 dias com `payload::text ILIKE '%Quero ver as novidades%'` (ou outras labels do `labelMap`).
2. Para cada telefone único, busca cliente em `ebd_clientes` (ordenado por `updated_at desc`, primeiro match).
3. Se ainda não tem registro em `ebd_retencao_contatos` com `resultado='interessado'` posterior à data do webhook, insere os registros em `ebd_retencao_contatos` e `retencao_respostas`.
4. Dispara `responder-interesse-novidades` para enviar a oferta de presente.

Pode reaproveitar o pattern de `backfill-interesse-presente` (lotes de 5, pausa de 30s) numa nova função `backfill-cliques-novidades-perdidos` ou estender a existente para também reprocessar cliques sem registro.

## Validação

- Após deploy, repetir clique de teste e verificar:
  - Log do webhook não deve dizer "cliente não encontrado".
  - Linha em `ebd_retencao_contatos` com `resultado='interessado'`.
  - Linha em `retencao_respostas` com `tipo='interesse'`.
  - Cliente aparece na coluna "Interessado" do Kanban.
- Conferir contagem antes/depois: hoje 23 → deve subir conforme backfill processa os cliques perdidos.
