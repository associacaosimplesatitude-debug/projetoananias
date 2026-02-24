
# Correção: bling-nfe-simple usando token errado para Penha

## Problema identificado

A função `bling-nfe-simple` tenta usar a tabela `bling_config_penha` (linha 77), mas os pedidos da loja Penha são criados na **conta unificada do Bling** (tabela `bling_config`). Resultado: o token de `bling_config_penha` pertence a outra conta OAuth e não consegue encontrar o pedido, causando o erro:

- "A nota deve ter ao menos um item"
- "Data de operação inválida"
- "O número do documento do contato não foi informado"

A própria função `bling-generate-nfe` já documenta isso (linha 369-372): "O Bling usa uma única conta OAuth para todas as filiais. Não existe bling_config_penha separado - usar sempre bling_config (RJ)."

**Matriz e Pernambuco funcionam** porque usam suas respectivas configs corretas. Penha falha porque `bling-nfe-simple` busca o token errado.

## Correção

### Arquivo: `supabase/functions/bling-nfe-simple/index.ts`

Alterar a lógica de busca de config (linhas 76-86) para usar **sempre** `bling_config` (a conta unificada RJ), igual ao que `bling-generate-nfe` já faz:

```
// ANTES (errado):
let tableName = 'bling_config_penha';
let { data: config } = await supabase.from(tableName).select('*').limit(1).single();
if (!config) {
  tableName = 'bling_config';
  ...
}

// DEPOIS (correto):
// Conta unificada - todas as filiais usam o mesmo token
let tableName = 'bling_config';
let { data: config } = await supabase.from(tableName).select('*').limit(1).single();
```

### Deploy

Fazer o redeploy da função `bling-nfe-simple` após a correção.

## Resultado esperado

A herança simples vai usar o token correto (mesmo que criou o pedido), a API do Bling vai encontrar o pedido e herdar os itens/contato, e o icone "V" laranja vai aparecer vinculando NF-e ao pedido.
