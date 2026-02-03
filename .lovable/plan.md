

# Plano: Corrigir Dashboard Admin EBD - Dados Truncados

## Problema Identificado

Os cards de vendas no Dashboard Admin EBD não exibem dados corretos porque:

| Tabela | Total Registros | Limite Supabase | Registros Perdidos |
|--------|-----------------|-----------------|-------------------|
| ebd_shopify_pedidos_cg | 1.318 | 1.000 | 318 |
| ebd_shopify_pedidos | 1.567 | 1.000 | 567 |
| bling_marketplace_pedidos | 2.841 | 1.000 | 1.841 |

O Supabase retorna no máximo 1.000 registros por query, fazendo com que dados recentes sejam ignorados nos cálculos.

## Solução Proposta

Criar uma função RPC no banco de dados que calcula os totais diretamente, evitando o limite de 1.000 registros e melhorando a performance.

### 1. Criar Função RPC para Agregação

Nova função `get_sales_channel_totals` que retorna totais por canal de vendas em um período específico:

```text
+---------------------------+
|  get_sales_channel_totals |
+---------------------------+
| Parâmetros:               |
| - start_date (timestamp)  |
| - end_date (timestamp)    |
+---------------------------+
          |
          v
+---------------------------+
| Retorno (JSON):           |
| - ecommerce_total         |
| - ecommerce_count         |
| - igreja_cnpj_total       |
| - igreja_cnpj_count       |
| - igreja_cpf_total        |
| - igreja_cpf_count        |
| - lojistas_total          |
| - lojistas_count          |
| - amazon_total/count      |
| - shopee_total/count      |
| - mercadolivre_total/count|
| - advecs_total/count      |
| - revendedores_total/count|
| - atacado_total/count     |
| - representantes_total    |
| - total_geral             |
+---------------------------+
```

### 2. Atualizar SalesChannelCards.tsx

Substituir as queries que buscam todos os registros por uma chamada RPC única que retorna totais pré-calculados.

### 3. Atualizar AdminEBD.tsx

Modificar as queries para:
- Usar a função RPC para os dados do dashboard
- Manter queries paginadas apenas onde for necessário listar registros individuais

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Migração SQL | Criar função `get_sales_channel_totals` |
| `src/components/admin/SalesChannelCards.tsx` | Usar RPC em vez de calcular no frontend |
| `src/pages/admin/AdminEBD.tsx` | Passar parâmetros de período para a função RPC |

### Função SQL (Migração)

```sql
CREATE OR REPLACE FUNCTION get_sales_channel_totals(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  -- Se datas não fornecidas, usa o dia de hoje
  IF p_start_date IS NULL THEN
    p_start_date := CURRENT_DATE::timestamptz;
  END IF;
  IF p_end_date IS NULL THEN
    p_end_date := (CURRENT_DATE + INTERVAL '1 day')::timestamptz;
  END IF;

  SELECT json_build_object(
    -- E-commerce (ebd_shopify_pedidos_cg)
    'ecommerce', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos_cg
      WHERE status_pagamento IN ('paid', 'Pago', 'Faturado')
        AND created_at >= p_start_date
        AND created_at < p_end_date
    ),
    -- Igreja CNPJ
    'igreja_cnpj', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(esp.valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos esp
      LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
      WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND esp.created_at >= p_start_date
        AND esp.created_at < p_end_date
        AND UPPER(ec.tipo_cliente) LIKE '%IGREJA%CNPJ%'
    ),
    -- Igreja CPF
    'igreja_cpf', (
      SELECT json_build_object(
        'valor', COALESCE(SUM(esp.valor_total), 0),
        'qtd', COUNT(*)
      )
      FROM ebd_shopify_pedidos esp
      LEFT JOIN ebd_clientes ec ON esp.cliente_id = ec.id
      WHERE esp.status_pagamento IN ('Pago', 'paid', 'Faturado')
        AND esp.created_at >= p_start_date
        AND esp.created_at < p_end_date
        AND UPPER(ec.tipo_cliente) LIKE '%IGREJA%CPF%'
    ),
    -- ... demais canais (Lojistas, Amazon, Shopee, etc.)
    'total_geral', (
      -- Soma de todos os canais
    )
  ) INTO result;

  RETURN result;
END;
$$;
```

### Alteração no SalesChannelCards.tsx

```typescript
// Nova query usando RPC
const { data: channelTotals } = useQuery({
  queryKey: ['sales-channel-totals', dateFilter, customDateRange],
  queryFn: async () => {
    const { start, endInclusive } = getDateRange();
    const { data, error } = await supabase.rpc('get_sales_channel_totals', {
      p_start_date: start.toISOString(),
      p_end_date: endInclusive.toISOString()
    });
    if (error) throw error;
    return data;
  }
});
```

### Resultado Esperado

Após a implementação:

| Card | Antes | Depois |
|------|-------|--------|
| E-commerce | R$ 327,43 | R$ 788,47 |
| Igreja CNPJ | R$ 0,00 | Valor correto |
| Igreja CPF | R$ 0,00 | Valor correto |
| Mercado Livre | R$ 89,02 | R$ 89,02 |
| Shopee | R$ 61,80 | R$ 61,80 |
| Total Geral | R$ 805,68 | ~R$ 939,29+ |

