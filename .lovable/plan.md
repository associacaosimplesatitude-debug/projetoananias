
# Plano: Sincronização de Vendas do Bling para Royalties

## Resumo

Integrar a página `/royalties/vendas` com o Bling ERP para importar automaticamente o histórico de vendas de livros cadastrados. O sistema irá buscar todos os pedidos de venda no Bling, filtrar os itens que correspondem aos livros cadastrados (via `bling_produto_id`), e calcular os royalties automaticamente.

---

## Fluxo de Uso

```text
+-------------------------------------------------------------------+
|                      VENDAS (Royalties)                           |
+-------------------------------------------------------------------+
|                                                                   |
|  [🔄 Sincronizar com Bling]    [➕ Registrar Venda Manual]        |
|                                                                   |
|  ┌─────────────────────────────────────────────────────────────┐  |
|  │ Cards de Resumo                                             │  |
|  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │  |
|  │ │ Total Vendas│ │ Qtd. Livros │ │ Total Royalties a Pagar │ │  |
|  │ │   R$ 15.450 │ │     342     │ │        R$ 1.545,00      │ │  |
|  │ └─────────────┘ └─────────────┘ └─────────────────────────┘ │  |
|  └─────────────────────────────────────────────────────────────┘  |
|                                                                   |
|  ┌─────────────────────────────────────────────────────────────┐  |
|  │ Tabela de Vendas                                            │  |
|  │ Data     | Livro           | Autor    | Qtd | Comissão      │  |
|  │ 29/01/26 | O Cativeiro...  | João...  |  5  | R$ 11,22      │  |
|  │ 28/01/26 | Jornada de Fé   | Maria... | 10  | R$ 45,00      │  |
|  │ ...                                                         │  |
|  └─────────────────────────────────────────────────────────────┘  |
|                                                                   |
+-------------------------------------------------------------------+
```

---

## Componentes

### 1. Edge Function: `bling-sync-royalties-sales`

Nova edge function para sincronizar vendas do Bling:

**Endpoint:** `POST /functions/v1/bling-sync-royalties-sales`

**Payload (opcional):**
```json
{
  "days_back": 90,
  "dry_run": false
}
```

**Resposta:**
```json
{
  "success": true,
  "synced": 15,
  "skipped": 5,
  "errors": 0,
  "summary": {
    "total_quantidade": 150,
    "total_valor_vendas": 3500.00,
    "total_royalties": 350.00
  }
}
```

**Lógica:**
1. Buscar todos os livros cadastrados com `bling_produto_id` preenchido
2. Buscar pedidos de venda no Bling (últimos N dias)
3. Para cada pedido, buscar detalhes e extrair itens
4. Filtrar itens que correspondem a livros cadastrados (comparar `codigo` com `bling_produto_id`)
5. Agrupar vendas por livro + data
6. Calcular comissão baseada no percentual do `royalties_comissoes`
7. Inserir na tabela `royalties_vendas` (com upsert para evitar duplicatas)

---

### 2. Migração: Adicionar campo `bling_order_id` na royalties_vendas

Para evitar duplicatas ao sincronizar:

```sql
ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS bling_order_id BIGINT DEFAULT NULL;

ALTER TABLE public.royalties_vendas 
ADD COLUMN IF NOT EXISTS bling_order_number TEXT DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_royalties_vendas_bling_unique 
ON public.royalties_vendas(bling_order_id, livro_id) 
WHERE bling_order_id IS NOT NULL;
```

---

### 3. Atualização: `Vendas.tsx`

Modificar a página de vendas para incluir:

1. **Botão "Sincronizar com Bling"** no cabeçalho
2. **Cards de resumo** com totais:
   - Total de vendas (R$)
   - Quantidade de livros vendidos
   - Total de royalties pendentes
3. **Indicador de sincronização** (última sincronização, status)
4. **Filtros** por período (últimos 7 dias, 30 dias, 90 dias, personalizado)

---

### 4. Componente: `BlingSyncButton`

Novo componente para o botão de sincronização:

**Props:**
```typescript
interface BlingSyncButtonProps {
  onSyncComplete: () => void;
}
```

**Funcionalidades:**
- Botão com ícone de refresh
- Estado de loading durante sincronização
- Toast com resultado da sincronização
- Exibir quantidade de registros sincronizados

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/bling-sync-royalties-sales/index.ts` | Edge function para sincronizar vendas do Bling |
| `src/components/royalties/BlingSyncButton.tsx` | Componente do botão de sincronização |
| `src/components/royalties/VendasSummaryCards.tsx` | Cards de resumo de vendas |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/royalties/Vendas.tsx` | Integrar componentes e sincronização |
| `supabase/config.toml` | Registrar nova edge function |

---

## Seção Técnica

### Lógica de Mapeamento Bling → Royalties

```text
┌─────────────────────────────────────────────────────────────────┐
│ BLING API                                                       │
│ GET /pedidos/vendas?dataInicial=2026-01-01&limite=100          │
│                                                                 │
│ Resposta (lista):                                              │
│ { data: [ { id: 123, ... }, { id: 456, ... } ] }               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ GET /pedidos/vendas/{id} (para cada pedido)                    │
│                                                                 │
│ Resposta (detalhes):                                           │
│ {                                                              │
│   id: 123,                                                     │
│   data: "2026-01-29",                                          │
│   situacao: { id: 31, nome: "Atendido" },                      │
│   itens: [                                                     │
│     { codigo: "9876543", descricao: "Livro X", quantidade: 2, │
│       valor: 45.90, produto: { id: 9876543 } }                 │
│   ]                                                            │
│ }                                                              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ LÓGICA DE SINCRONIZAÇÃO                                        │
│                                                                 │
│ 1. Carregar livros com bling_produto_id preenchido             │
│    Map<bling_produto_id, { livro_id, percentual }>             │
│                                                                 │
│ 2. Para cada item do pedido:                                   │
│    - Verificar se item.codigo ou item.produto.id está no Map   │
│    - Se sim, calcular royalty:                                 │
│      valor_comissao = item.valor * item.quantidade * percentual │
│                                                                 │
│ 3. Upsert em royalties_vendas (ON CONFLICT bling_order_id,     │
│    livro_id)                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Rate Limiting

O Bling permite 3 requisições/segundo. A edge function implementará:
- Delay de 350ms entre chamadas
- Retry automático em caso de 429 (Too Many Requests)
- Limite de 500 pedidos por sincronização

### Filtros de Pedidos

Apenas pedidos com status "Atendido" (id: 31 ou similar) serão considerados vendas efetivas. Pedidos cancelados ou pendentes serão ignorados.

### Estrutura da Edge Function

```text
bling-sync-royalties-sales/
└── index.ts
    ├── corsHeaders
    ├── refreshBlingToken() - Renovar token se expirado
    ├── isTokenExpired() - Verificar expiração
    ├── blingApiCall() - Chamada com retry/rate limit
    ├── loadBooksWithBlingId() - Carregar livros do DB
    ├── loadComissions() - Carregar percentuais
    ├── syncOrders() - Loop principal
    └── serve() - Handler
```

### Campos Inseridos em royalties_vendas

| Campo | Origem |
|-------|--------|
| `livro_id` | Mapeamento via bling_produto_id |
| `quantidade` | item.quantidade |
| `valor_unitario` | item.valor |
| `valor_comissao_unitario` | calculado |
| `valor_comissao_total` | calculado |
| `data_venda` | pedido.data |
| `bling_order_id` | pedido.id |
| `bling_order_number` | pedido.numero |

---

## Sequência de Implementação

1. **Database:** Adicionar colunas `bling_order_id` e `bling_order_number` em `royalties_vendas`
2. **Edge Function:** Criar `bling-sync-royalties-sales`
3. **Componentes:** Criar `BlingSyncButton` e `VendasSummaryCards`
4. **Integração:** Atualizar `Vendas.tsx` com novos componentes
5. **Config:** Registrar função no `config.toml`
6. **Testes:** Validar sincronização com dados reais

---

## Considerações

- **Livros sem `bling_produto_id`:** Não serão sincronizados automaticamente. O usuário deve vincular os livros ao Bling no cadastro.
- **Vendas manuais:** O botão "Registrar Venda" continua disponível para vendas fora do Bling.
- **Duplicatas:** O índice único em `(bling_order_id, livro_id)` garante que cada item de pedido seja sincronizado apenas uma vez.
- **Performance:** A primeira sincronização pode levar alguns minutos para processar histórico extenso.
