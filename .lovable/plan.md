
# Corrigir Sincronizacao de Vendas - Preencher codigo_bling (SKU) dos Livros

## Problema Raiz

Apenas 2 livros tem vendas aparecendo porque **somente 2 livros possuem o campo `codigo_bling` (SKU) preenchido**: "O Cativeiro Babilonico" (SKU: 33476) e "Mulheres Em Reforma" (SKU: 33455). Os outros 27 livros tem `codigo_bling = null`.

A funcao de sincronizacao (`bling-sync-royalties-sales`) tenta casar itens de NF-e com livros usando `bling_produto_id` ou `codigo_bling`. Porem, nas NF-es do Bling, os itens usam o **codigo (SKU)** do produto, nao o ID do produto. Sem o SKU preenchido, o sistema nao consegue identificar quais livros foram vendidos.

## Solucao em 2 Partes

### Parte 1: Criar Edge Function para preencher automaticamente o `codigo_bling`

Nova Edge Function `backfill-royalties-bling-skus` que:
1. Busca todos os livros que tem `bling_produto_id` mas nao tem `codigo_bling`
2. Para cada livro, consulta a API do Bling (`GET /produtos/{id}`) para obter o campo `codigo` (SKU)
3. Atualiza o campo `codigo_bling` na tabela `royalties_livros`
4. Respeita rate limit do Bling (350ms entre chamadas)

### Parte 2: Melhorar a sincronizacao de vendas

**Arquivo:** `supabase/functions/bling-sync-royalties-sales/index.ts`

Melhorias:
- Aumentar limite de paginas de NFes de 5 para 20 (para cobrir periodo de 1 Jan ate hoje)
- Aumentar `maxNfes` default para 500 (era 30)
- Garantir que `data_venda` use a data de emissao da NF-e (ja faz isso, mas verificar)

**Arquivo:** `src/components/royalties/BlingSyncButton.tsx`

- Adicionar opcao "Desde 01/Jan" no dropdown de periodos

### Parte 3: Adicionar botao de backfill na pagina de Vendas

**Arquivo:** `src/pages/royalties/Vendas.tsx`

- Adicionar botao "Preencher SKUs" que chama a nova Edge Function antes de sincronizar

---

## Detalhes Tecnicos

### Nova Edge Function: `backfill-royalties-bling-skus`

```text
1. Buscar bling_config para obter access_token
2. Buscar royalties_livros WHERE bling_produto_id IS NOT NULL AND codigo_bling IS NULL
3. Para cada livro:
   a. GET /Api/v3/produtos/{bling_produto_id}
   b. Extrair campo "codigo" da resposta
   c. UPDATE royalties_livros SET codigo_bling = codigo WHERE id = livro.id
   d. Aguardar 400ms (rate limit)
4. Retornar quantidade de SKUs preenchidos
```

### Sync Function - Mudancas

```text
- Aumentar page limit: while (hasMore && page <= 20)  // era 5
- Aumentar maxNfes default: maxNfes = body.max_nfes || 500  // era 30
- Manter data_venda = nfeData.dataEmissao (ja correto)
```

### BlingSyncButton - Nova opcao

```text
PERIOD_OPTIONS adicionar:
  { days: -1, label: "Desde 01/Jan" }  // valor especial

No handleSync, quando days === -1:
  Calcular days_back = dias desde 01/Janeiro ate hoje
  Enviar max_nfes: 500
```

### Fluxo do Usuario

1. Clicar "Preencher SKUs" (uma vez) - preenche codigo_bling de todos os livros
2. Clicar "Sincronizar > Desde 01/Jan" - puxa todas as NF-es desde janeiro
3. Historico de vendas mostra todos os livros com datas corretas e notas fiscais
