
# Correção do Consultor de BI - Informações de PRODUTOS

## Problema Identificado

O Consultor de BI confunde **CLIENTE** com **PRODUTO**. Quando perguntamos "qual produto foi mais vendido", ele retorna o nome do cliente (Igreja, pessoa) em vez do produto real (Livro, Revista, Bíblia).

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    PROBLEMA: CLIENTE ≠ PRODUTO                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   PERGUNTA: "Qual produto mais vendido hoje?"                           │
│                                                                         │
│   RESPOSTA ERRADA (atual):                                              │
│   - "IGREJA BATISTA SEMEAR" ← Isso é CLIENTE, não produto!              │
│   - "Jorge Luis" ← Isso é CLIENTE, não produto!                         │
│                                                                         │
│   RESPOSTA CORRETA (esperada):                                          │
│   - "Livro Silas Malafaia Em Foco" ← Isso sim é PRODUTO!                │
│   - "Bíblia Mulher Vitoriosa Branca" ← Isso sim é PRODUTO!              │
│                                                                         │
│   CAUSA: O SYSTEM_PROMPT não documenta as tabelas de ITENS              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Estrutura Real de PRODUTOS no Banco

Os produtos vendidos estão armazenados em locais diferentes para cada tipo de venda:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FONTES DE PRODUTOS POR TABELA                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. ebd_shopify_pedidos (Shopify Online)                               │
│      → Produtos em TABELA SEPARADA: ebd_shopify_pedidos_itens           │
│      → Campos: product_title, quantity, price, sku                      │
│      → JOIN: pedido_id = ebd_shopify_pedidos.id                         │
│                                                                         │
│   2. vendedor_propostas (B2B / Faturamento)                             │
│      → Produtos em COLUNA JSONB: itens                                  │
│      → Estrutura: [{"title": "...", "quantity": N, "price": X}]         │
│      → Acessar: itens->>'title', (itens->>'quantity')::int              │
│                                                                         │
│   3. ebd_shopify_pedidos_mercadopago (Pagamentos Digitais)              │
│      → Produtos em COLUNA JSONB: items                                  │
│      → Estrutura: [{"title": "...", "quantity": N, "price": X}]         │
│      → Acessar: items->>'title', (items->>'quantity')::int              │
│                                                                         │
│   4. vendas_balcao (PDV / Pagar na Loja)                                │
│      → NÃO TEM ITENS DETALHADOS                                         │
│      → Apenas valor total, sem detalhe de produtos                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Exemplo de Query Correta para "Produto Mais Vendido Hoje"

```sql
-- Produtos do Shopify (tabela separada)
SELECT i.product_title, SUM(i.quantity) as total_qty
FROM ebd_shopify_pedidos_itens i
JOIN ebd_shopify_pedidos p ON i.pedido_id = p.id
WHERE p.status_pagamento = 'paid' AND p.created_at::date = CURRENT_DATE
GROUP BY i.product_title ORDER BY total_qty DESC LIMIT 5

-- Produtos das Propostas B2B (JSONB)
SELECT 
  item->>'title' as produto,
  SUM((item->>'quantity')::int) as total_qty
FROM vendedor_propostas, jsonb_array_elements(itens) AS item
WHERE status IN ('FATURADO', 'PAGO') AND created_at::date = CURRENT_DATE
GROUP BY item->>'title' ORDER BY total_qty DESC LIMIT 5

-- Produtos do Mercado Pago (JSONB)
SELECT 
  item->>'title' as produto,
  SUM((item->>'quantity')::int) as total_qty
FROM ebd_shopify_pedidos_mercadopago, jsonb_array_elements(items) AS item
WHERE status = 'PAGO' AND created_at::date = CURRENT_DATE
GROUP BY item->>'title' ORDER BY total_qty DESC LIMIT 5
```

## Alterações Necessárias

### Arquivo: `supabase/functions/gemini-assistente-gestao/index.ts`

Adicionar ao SYSTEM_PROMPT uma nova seção sobre **PRODUTOS**:

### Nova Seção a Adicionar

```markdown
## IMPORTANTE: Diferença entre CLIENTE e PRODUTO

- **CLIENTE** = quem comprou (Igreja, pessoa, empresa)
  - Campos: cliente_nome, customer_name
  
- **PRODUTO** = o que foi comprado (Livro, Revista, Bíblia)
  - Vem das tabelas de ITENS (veja abaixo)

Quando o usuário perguntar sobre PRODUTOS vendidos, você deve consultar as tabelas de ITENS, não as tabelas de pedidos!

## Fontes de PRODUTOS (Itens Vendidos)

### 1. ebd_shopify_pedidos_itens (Itens de pedidos Shopify)
- Campos: id, pedido_id, product_title, variant_title, sku, quantity, price, total_discount
- **Campo do produto**: product_title
- JOIN com ebd_shopify_pedidos: WHERE i.pedido_id = p.id

Exemplo - Produtos mais vendidos hoje no Shopify:
SELECT i.product_title, SUM(i.quantity) as total_qty, SUM(i.price * i.quantity) as total_valor
FROM ebd_shopify_pedidos_itens i
JOIN ebd_shopify_pedidos p ON i.pedido_id = p.id
WHERE p.status_pagamento = 'paid' AND p.created_at::date = CURRENT_DATE
GROUP BY i.product_title ORDER BY total_qty DESC

### 2. vendedor_propostas.itens (JSONB com itens B2B)
- Estrutura JSON: [{"title": "Nome do Produto", "quantity": 10, "price": 49.90, "sku": "123"}]
- **Campo do produto**: itens->>'title'
- Usar jsonb_array_elements() para expandir o array

Exemplo - Produtos mais vendidos hoje em propostas B2B:
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as total_qty
FROM vendedor_propostas, jsonb_array_elements(itens) AS item
WHERE status IN ('FATURADO', 'PAGO') AND created_at::date = CURRENT_DATE AND itens IS NOT NULL
GROUP BY item->>'title' ORDER BY total_qty DESC

### 3. ebd_shopify_pedidos_mercadopago.items (JSONB com itens MP)
- Estrutura JSON: [{"title": "Nome do Produto", "quantity": 5, "price": 69.90}]
- **Campo do produto**: items->>'title'
- Usar jsonb_array_elements() para expandir o array

Exemplo - Produtos mais vendidos hoje no Mercado Pago:
SELECT item->>'title' as produto, SUM((item->>'quantity')::int) as total_qty
FROM ebd_shopify_pedidos_mercadopago, jsonb_array_elements(items) AS item
WHERE status = 'PAGO' AND created_at::date = CURRENT_DATE AND items IS NOT NULL
GROUP BY item->>'title' ORDER BY total_qty DESC

### 4. vendas_balcao - NÃO TEM ITENS
- Vendas de balcão não possuem detalhamento de produtos
- Apenas valor total e dados do cliente
- Para perguntas sobre produtos de balcão, informe que não há detalhamento disponível

## Resumo: CLIENTE vs PRODUTO

| Pergunta do Usuário | Tabela a Consultar | Campo a Usar |
|--------------------|-------------------|--------------|
| "Qual CLIENTE comprou mais?" | Tabelas de pedidos | cliente_nome, customer_name |
| "Qual PRODUTO vendeu mais?" | Tabelas de ITENS | product_title, item->>'title' |
| "Clientes da Gloria" | Tabelas de pedidos | cliente_nome, customer_name |
| "Produtos vendidos pela Gloria" | Tabelas de ITENS + JOIN | product_title, item->>'title' |
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/gemini-assistente-gestao/index.ts` | Adicionar seção sobre PRODUTOS no SYSTEM_PROMPT, documentando as 3 fontes de itens e exemplos de queries para buscar produtos vendidos |

## Resultado Esperado

Após as correções:

| Pergunta | Comportamento Atual | Comportamento Esperado |
|----------|--------------------|-----------------------|
| "Produto mais vendido hoje" | "IGREJA BATISTA SEMEAR" (cliente) | "Livro Silas Malafaia Em Foco" (produto) |
| "Top 5 produtos do mês" | Retorna clientes | Retorna produtos reais |
| "Quais produtos a Gloria vendeu?" | Não encontra | Lista produtos com quantity |

O Consultor de BI passará a:
- Diferenciar entre pergunta sobre CLIENTE e sobre PRODUTO
- Consultar tabelas de ITENS quando perguntarem sobre produtos
- Usar jsonb_array_elements() para extrair itens de colunas JSONB
- Informar quando não há detalhamento (vendas_balcao)
