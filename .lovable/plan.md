
# Consulta: Vendas do SKU 33012 no Bling (01/01/2026 - 02/02/2026)

## Situação Atual

1. **Produto encontrado no Bling:**
   - SKU: 33012
   - Nome: TEOLOGIA PARA PENTECOSTAIS
   - ID Bling: 15845908742
   - Preço: R$ 399,90
   - Estoque atual: 1997 unidades

2. **Problema identificado:**
   O livro **não está cadastrado** na tabela `royalties_livros`, por isso a sincronização de royalties não consegue rastreá-lo. Apenas 2 livros estão mapeados no sistema de royalties.

## Solução Proposta

Criar uma Edge Function `bling-count-sku-sales` que:
1. Consulta todas as NF-e autorizadas no período (01/01/2026 até 02/02/2026)
2. Busca os detalhes de cada NF-e
3. Filtra apenas os itens com SKU = 33012
4. Retorna a quantidade total vendida

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/bling-count-sku-sales/index.ts` | Edge Function para contar vendas por SKU |

### Lógica da Edge Function

```typescript
// Parâmetros de entrada:
{
  "sku": "33012",
  "data_inicial": "2026-01-01",
  "data_final": "2026-02-02"
}

// Resultado esperado:
{
  "success": true,
  "sku": "33012",
  "produto_nome": "TEOLOGIA PARA PENTECOSTAIS",
  "periodo": { "de": "2026-01-01", "ate": "2026-02-02" },
  "total_quantidade": X,
  "total_notas": Y,
  "detalhes": [
    { "nfe_numero": "123", "data": "2026-01-15", "quantidade": 2 },
    ...
  ]
}
```

## Seção Técnica

A Edge Function irá:

1. Buscar configuração do Bling e validar token
2. Fazer paginação das NF-e autorizadas (status = 6) no período
3. Para cada NF-e, buscar detalhes dos itens
4. Filtrar itens cujo `codigo` == SKU informado
5. Somar quantidades e retornar resumo

### Rate Limiting
- 400ms entre chamadas (Bling permite ~3 req/s)
- Retry automático em caso de erro 429

### Endpoint da API Bling
```
GET /nfe?dataEmissaoInicial=YYYY-MM-DD&dataEmissaoFinal=YYYY-MM-DD&limite=100&pagina=X
GET /nfe/{id} (detalhes)
```

## Resultado Esperado

Após a implementação, você poderá executar:
```
POST /bling-count-sku-sales
{ "sku": "33012", "data_inicial": "2026-01-01", "data_final": "2026-02-02" }
```

E obter o número exato de unidades vendidas do "Teologia para Pentecostais" no período solicitado.
