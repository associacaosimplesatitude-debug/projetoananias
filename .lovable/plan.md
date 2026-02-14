

# Funil "Primeira Compra" direto de Pedidos Online (ebd_shopify_pedidos)

## Contexto

A etapa "Primeira Compra" do funil atualmente depende da tabela `ebd_pos_venda_ecommerce`, que nao tem todos os pedidos (faltam janeiro e fevereiro). A solucao e buscar direto da tabela `ebd_shopify_pedidos`, que ja tem todos os pedidos do e-commerce sincronizados.

Para identificar primeira compra, usaremos a logica recomendada pela Shopify: verificar se o `customer_email` aparece pela primeira vez no sistema. Ou seja, o primeiro pedido daquele email e a "primeira compra".

### Numeros atuais
- **516** clientes fizeram sua primeira compra a partir de Dez/2025
- **87** clientes ja tinham comprado antes de Dez/2025 (recorrentes)

## O que muda

### Arquivo: `src/pages/vendedor/VendedorFunil.tsx`

A etapa `compra_aprovada` deixa de consultar `ebd_pos_venda_ecommerce` e passa a consultar diretamente `ebd_shopify_pedidos`.

### Logica de contagem (card)

```text
1. Buscar todos os pedidos pagos (status_pagamento = 'paid') desde sempre
2. Agrupar por customer_email e pegar a data do primeiro pedido (MIN created_at)
3. Filtrar apenas os que tem primeiro pedido >= 01/12/2025
4. Se nao for admin, filtrar por vendedor_id
5. Contar o total
```

Como o Supabase JS nao suporta GROUP BY/HAVING diretamente, a abordagem sera:
- Buscar pedidos pagos com `created_at >= '2025-12-01'`
- Verificar se cada `customer_email` nao tem pedidos anteriores a Dez/2025 (ou usar uma abordagem com RPC/subquery)
- Alternativa mais simples: buscar todos os pedidos e filtrar no JS quais emails aparecem pela primeira vez desde Dez/2025

### Logica de listagem expandida

Quando expandir o card, mostrar:
- **Nome do cliente** (`customer_name`)
- **Telefone** (`customer_phone`)
- **Valor** (`valor_total`)
- **Data** (`created_at`)
- **Status WhatsApp** (mantido)
- **Vendedor** (se admin view)

### Abordagem tecnica (eficiente)

Criar uma funcao SQL (RPC) no banco para fazer a query de forma eficiente:

```sql
-- Funcao que retorna primeira compra de cada cliente desde uma data
-- Agrupa por email, pega MIN(created_at), filtra >= data_inicio
-- Retorna os dados do pedido correspondente
```

Ou, se preferir manter tudo no frontend sem RPC:
1. Buscar todos pedidos pagos desde Dez/2025 da `ebd_shopify_pedidos`
2. No JS, agrupar por `customer_email`
3. Para cada email, pegar apenas o primeiro pedido (menor `created_at`)
4. Verificar se esse email NAO aparece em pedidos anteriores a Dez/2025
5. Resultado: lista de primeiras compras

### Renderizacao

```text
AMANDA DE OLIVEIRA          R$ 78,98    14/02/2026    [Sem envio]
  33991307574
```

## Resumo das alteracoes

1. **Criar funcao SQL** `get_primeira_compra_funil` para consulta eficiente de primeiras compras
2. **Editar** `src/pages/vendedor/VendedorFunil.tsx` - trocar a fonte de dados da etapa "Primeira Compra" de `ebd_pos_venda_ecommerce` para `ebd_shopify_pedidos` via RPC
3. A contagem e a listagem passam a mostrar dados reais e completos (Dez/2025 ate hoje)

