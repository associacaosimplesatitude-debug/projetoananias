

# Plano: Corrigir Sincronização de Vendas Bling para Royalties

## Diagnóstico

Após investigação detalhada da API V3 do Bling:

1. **Problema de timeout**: A função atual percorre cada pedido individualmente (buscar lista + buscar detalhes = 2 chamadas por pedido), o que causa timeout com volumes grandes
2. **API do Bling não expõe "peças vendidas"**: O valor que aparece no Dashboard de Sugestão de Compras é calculado internamente pelo Bling usando movimentações de estoque
3. **Livro cadastrado corretamente**: O livro "O Cativeiro Babilônico" tem `bling_produto_id: 16565106635` no banco de dados

## Solução: Usar Notas Fiscais (NFe) ao invés de Pedidos

As Notas Fiscais são mais confiáveis para royalties porque:
- Representam vendas **efetivamente faturadas**
- Possuem volume menor (menos chamadas API)
- Contêm os itens vendidos com quantidades exatas

---

## Alterações Técnicas

### 1. Reescrever Edge Function: `bling-sync-royalties-sales`

**Mudança de abordagem:**
- Buscar **Notas Fiscais (NFe)** em vez de Pedidos de Venda
- Endpoint: `GET /nfe?dataEmissaoInicial={data}&limite=100`
- Filtrar apenas notas com situação "Autorizada" (situacao = 3)

**Novo fluxo:**
```text
1. Buscar NFs autorizadas nos últimos N dias
2. Para cada NF:
   - Buscar detalhes da NF para obter itens
   - Verificar se item.codigo ou item.id está no Map de livros
   - Calcular royalties se for um livro cadastrado
3. Inserir registros únicos no banco (evitar duplicatas por NF + livro)
```

**Otimizações:**
- Processar em batches de 30 dias para evitar timeout
- Adicionar parâmetro `batch_size` para controlar volume
- Retornar progresso incremental

### 2. Schema da resposta da API de NFe

Campos relevantes da resposta do Bling:
```json
{
  "data": [{
    "id": 123456,
    "numero": "000001234",
    "dataEmissao": "2026-01-15",
    "situacao": 3, // 3 = Autorizada
    "itens": [{
      "id": 789,
      "codigo": "33476",
      "descricao": "O Cativeiro Babilônico...",
      "quantidade": 5,
      "valor": 22.45
    }]
  }]
}
```

### 3. Endpoint alternativo: Buscar NF por código do produto

Se a API permitir, filtrar diretamente:
`GET /nfe?idsProdutos[]={bling_produto_id}&dataEmissaoInicial={data}`

Isso reduziria drasticamente o volume de dados processados.

---

## Modificações nos Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/bling-sync-royalties-sales/index.ts` | Reescrever para usar endpoint de NFe |
| `src/components/royalties/BlingSyncButton.tsx` | Adicionar seletor de período (30/60/90/180 dias) |
| `src/components/royalties/VendasSummaryCards.tsx` | Sem alterações |

---

## Nova Lógica da Edge Function

### Estrutura do código

```text
bling-sync-royalties-sales/
└── index.ts
    ├── corsHeaders
    ├── refreshBlingToken() - Renovar token
    ├── blingApiCall() - Chamada com retry/rate limit
    ├── loadBooksWithBlingId() - Carregar livros do DB
    ├── fetchNFeList() - Buscar lista de NFs autorizadas
    ├── fetchNFeDetails() - Buscar detalhes de uma NF
    ├── syncNFeItems() - Processar itens das NFs
    └── serve() - Handler principal
```

### Filtro de situação NFe

| ID | Situação | Incluir |
|----|----------|---------|
| 1 | Pendente | Não |
| 2 | Processando | Não |
| 3 | **Autorizada** | **Sim** |
| 4 | Cancelada | Não |
| 5 | Denegada | Não |

### Campos a inserir em `royalties_vendas`

| Campo | Origem |
|-------|--------|
| `livro_id` | Mapeamento via bling_produto_id |
| `quantidade` | item.quantidade |
| `valor_unitario` | item.valor |
| `valor_comissao_unitario` | calculado |
| `valor_comissao_total` | calculado |
| `data_venda` | nfe.dataEmissao |
| `bling_order_id` | nfe.id (ID da NF) |
| `bling_order_number` | nfe.numero |

---

## Fluxo do Usuário

1. Acessar `/royalties/vendas`
2. Selecionar período (padrão: 90 dias)
3. Clicar em "Sincronizar com Bling"
4. Aguardar processamento (com feedback de progresso)
5. Ver resumo: X notas processadas, Y livros encontrados, Z royalties calculados
6. Verificar cards de resumo e tabela de vendas atualizados

---

## Cronograma de Implementação

1. Atualizar edge function com nova lógica de NFe
2. Adicionar seletor de período no botão de sincronização
3. Testar com período pequeno (7 dias) primeiro
4. Expandir para 30, 60, 90 dias
5. Validar quantidade total (deve se aproximar de 1164 ao longo do tempo)

---

## Considerações Importantes

- **Período de dados**: O valor de 1164 peças é de 01/12/2025 a 29/01/2026 (60 dias). Precisamos sincronizar esse período específico
- **Rate limiting**: A função respeitará o limite de 3 req/s do Bling
- **Timeout**: Cada chamada da função processa um batch de 30 dias para evitar timeout de 26s
- **Duplicatas**: O índice único `(bling_order_id, livro_id)` previne registros duplicados

