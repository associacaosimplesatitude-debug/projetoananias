
# Plano: Preencher NF/DANFE das Vendas Existentes

## Problema Identificado

As vendas foram sincronizadas antes da implementacao dos campos `nota_fiscal_numero` e `nota_fiscal_url`. Por isso, os dados estao assim:

| Campo | Valor |
|-------|-------|
| bling_order_number | 030538, 000356, 030584 (preenchido) |
| nota_fiscal_numero | NULL |
| nota_fiscal_url | NULL |

A Edge Function atual so insere novos registros - nao atualiza os existentes.

## Solucao

Criar uma Edge Function dedicada para atualizar os campos de NF das vendas existentes, buscando os links DANFE diretamente da API do Bling.

## Etapa 1: Nova Edge Function sync-royalties-nfe-links

Criar uma funcao que:
1. Busca todas as vendas com `bling_order_id` preenchido mas `nota_fiscal_url` nulo
2. Para cada uma, busca os detalhes da NFe na API do Bling
3. Atualiza os campos `nota_fiscal_numero` e `nota_fiscal_url`

```typescript
// Para cada venda sem NF link
const nfeDetails = await blingApiCall(accessToken, `/nfe/${venda.bling_order_id}`);

await supabase
  .from("royalties_vendas")
  .update({
    nota_fiscal_numero: nfeDetails.data.numero?.toString(),
    nota_fiscal_url: nfeDetails.data.linkPDF || nfeDetails.data.linkDanfe
  })
  .eq("id", venda.id);
```

## Etapa 2: Botao na Interface

Adicionar um botao "Atualizar NFs" na pagina de vendas que chama essa funcao para preencher os links faltantes.

## Etapa 3: UI Corrigida

A coluna NF mostrara:
- Link clicavel "NF 030538" quando tiver URL
- "Aguardando" quando nao tiver URL ainda

## Arquivos a Criar/Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/sync-royalties-nfe-links/index.ts` | Nova funcao para atualizar NF |
| `src/pages/royalties/Vendas.tsx` | Botao para sincronizar NFs |

## Secao Tecnica

### Nova Edge Function

```typescript
// supabase/functions/sync-royalties-nfe-links/index.ts

// 1. Buscar vendas sem nota_fiscal_url mas com bling_order_id
const { data: vendasSemNF } = await supabase
  .from("royalties_vendas")
  .select("id, bling_order_id")
  .not("bling_order_id", "is", null)
  .is("nota_fiscal_url", null);

// 2. Para cada venda, buscar detalhes da NFe
for (const venda of vendasSemNF) {
  const nfeDetails = await blingApiCall(accessToken, `/nfe/${venda.bling_order_id}`);
  const nfeData = nfeDetails.data;
  
  // 3. Atualizar campos
  await supabase
    .from("royalties_vendas")
    .update({
      nota_fiscal_numero: nfeData.numero?.toString(),
      nota_fiscal_url: nfeData.linkPDF || nfeData.linkDanfe || nfeData.link
    })
    .eq("id", venda.id);
}
```

### Resultado Esperado

Apos rodar a sincronizacao:

| Data | Qtd | Comissao | NF |
|------|-----|----------|-----|
| 27/01/2026 | 1 | R$ 1,12 | NF 030538 (link) |
| 28/01/2026 | 1 | R$ 1,12 | NF 000356 (link) |
| 28/01/2026 | 6 | R$ 6,74 | NF 030584 (link) |
