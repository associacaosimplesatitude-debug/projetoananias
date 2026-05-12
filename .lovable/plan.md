## Causa raiz

O erro "Erro ao criar pedido no Bling" ao aprovar faturamento vem da Edge Function `bling-create-order`. Os logs mostram a resposta literal da API do Bling:

```
{"type":"FORBIDDEN","message":"Acesso negado",
 "description":"A URL 'www.bling.com.br' está bloqueada para requisições de API.
               Por favor, utilize o endpoint oficial: 'api.bling.com.br'."}
```

Ou seja, o Bling deixou de aceitar chamadas em `https://www.bling.com.br/Api/v3/...` e agora exige `https://api.bling.com.br/Api/v3/...`. Hoje o projeto usa o domínio antigo em **30 Edge Functions** (≈110 ocorrências), incluindo criação de pedido, contato, NF-e, estoque, situações, OAuth, etc. Tudo que toca o Bling está exposto a esse mesmo erro — só não estourou ainda em outras telas porque a chamada bloqueada apareceu primeiro no fluxo de aprovação.

## Plano

Substituir, em todas as Edge Functions Bling, o host `https://www.bling.com.br` por `https://api.bling.com.br` (mantendo o restante do path `/Api/v3/...` intacto). Sem mudar lógica, payloads ou nomes de função.

### Arquivos afetados (30)

OAuth/refresh:
- `bling-refresh-token`, `bling-callback`, `bling-callback-penha`, `bling-callback-pe`

Núcleo do pedido (causa imediata do bug):
- `bling-create-order` (25 ocorrências)
- `bling-update-order`, `bling-get-order-details`, `bling-find-order-id`, `bling-list-my-orders`, `bling-sync-order-status`, `bling-link-orders`, `backfill-bling-order-ids`

NF-e / royalties / comissões:
- `bling-generate-nfe`, `bling-get-nfe-by-order-id`, `sync-nf-danfe-batch`, `sync-comissoes-nfe`, `sync-royalties-nfe-links`, `bling-sync-royalties-sales`, `backfill-royalties-bling-skus`

Produtos / contatos / estoque / outros:
- `bling-sync-products`, `bling-search-product`, `bling-search-client`, `bling-check-stock`, `bling-list-empresas`, `bling-sync-marketplace-orders`, `bling-search-campaign-audience`, `bling-backfill-documents`, `bling-advec-total`, `api-bling`, `gemini-assistente-gestao`

### Execução

1. Rodar substituição automatizada em `supabase/functions/**/index.ts`:
   `https://www.bling.com.br/Api/v3` → `https://api.bling.com.br/Api/v3`
2. Validar com `rg "www.bling.com.br" supabase/functions/` (deve retornar zero).
3. Deploy das 30 functions.
4. Reaprovar a proposta `a978cfdc-…` em `/admin/ebd/aprovacao-faturamento` para confirmar.

### Fora do escopo

- Não alterar nomes, parâmetros, RLS, schema, frontend, ou config.toml.
- Não atualizar a lib oficial nem refatorar `bling-create-order` (apenas o host).
- O domínio `www.bling.com.br` no documento OAuth (`/Api/v3/oauth/token`) também é trocado — a Bling aceita o endpoint OAuth no mesmo host `api.bling.com.br`, conforme orientação do erro retornado.
