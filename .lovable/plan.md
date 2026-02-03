

# Plano: Corrigir Dashboard Admin EBD - Dados Não Aparecem nos Cards

## Problemas Identificados

Após análise detalhada do banco de dados, encontrei as seguintes causas:

| Problema | Impacto | Solução |
|----------|---------|---------|
| Pedidos Mercado Pago não incluídos | 62+ vendas não contabilizadas | Adicionar tabela `ebd_shopify_pedidos_mercadopago` na função RPC |
| 1.331 pedidos sem cliente vinculado | Não classificados por tipo | Usar lógica alternativa ou criar card "Não Classificado" |
| Pessoa Física sem card próprio | ~90 clientes não visíveis | Criar card "Pessoa Física" |
| ADVECS/Revendedores/Lojistas com tipo diferente | Alguns tipos não casam exatamente | Melhorar LIKE para pegar variações |
| Propostas com tipos diferentes | Não somam corretamente | Ajustar filtros de tipo |

## Dados Verificados no Banco

Exemplo concreto que você mencionou:
- **IGREJA DO EVANGELHO QUADRANGULAR** (tipo_cliente: IGREJA CNPJ)
- Pedido #MPCB51125F de R$ 268,23 via Mercado Pago
- Criado em 02/02/2026 17:44 (horário Brasil)
- **Este pedido está na tabela `ebd_shopify_pedidos_mercadopago`, que NÃO está na função RPC atual**

## Solução Proposta

### 1. Atualizar Função RPC `get_sales_channel_totals`

Modificar para incluir:

- Tabela **ebd_shopify_pedidos_mercadopago** (pedidos Mercado Pago pagos)
- Card **Pessoa Física** separado
- Melhorar lógica de classificação por tipo (LIKE mais flexível)
- Distribuir pedidos Mercado Pago nos cards corretos (Igreja CNPJ, CPF, Lojistas, etc.)

### 2. Estrutura Atualizada dos Canais

```text
+------------------+------------------------+
| Card             | Fonte de Dados         |
+------------------+------------------------+
| E-commerce       | ebd_shopify_pedidos_cg |
| Igreja CNPJ      | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago (tipo_cliente LIKE '%IGREJA%CNPJ%') |
| Igreja CPF       | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago (tipo_cliente LIKE '%IGREJA%CPF%') |
| Lojistas         | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago (tipo_cliente LIKE '%LOJISTA%') |
| Pessoa Física    | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago (tipo_cliente LIKE '%PESSOA%' OU '%FISICA%') |
| ADVECS           | bling_marketplace + ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago (tipo_cliente LIKE '%ADVEC%') |
| Revendedores     | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago + propostas (tipo_cliente LIKE '%REVENDEDOR%') |
| Representantes   | ebd_shopify_pedidos + ebd_shopify_pedidos_mercadopago + propostas (tipo_cliente LIKE '%REPRESENTANTE%') |
| Amazon           | bling_marketplace_pedidos (marketplace = 'AMAZON') |
| Shopee           | bling_marketplace_pedidos (marketplace = 'SHOPEE') |
| Mercado Livre    | bling_marketplace_pedidos (marketplace = 'MERCADO_LIVRE') |
| Atacado          | bling_marketplace_pedidos (marketplace = 'ATACADO') |
| TOTAL GERAL      | Soma de todos os canais |
+------------------+------------------------+
```

### 3. Atualizar Frontend

Adicionar novo card "Pessoa Física" no componente `SalesChannelCards.tsx`.

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| Nova Migração SQL | Atualizar função `get_sales_channel_totals` |
| `src/components/admin/SalesChannelCards.tsx` | Adicionar card Pessoa Física e consumir novos dados do RPC |

### SQL da Nova Função RPC

A função será atualizada para:

1. **Incluir `ebd_shopify_pedidos_mercadopago`** nos cálculos de cada tipo de cliente
2. **Criar entrada `pessoa_fisica`** agregando pedidos onde `tipo_cliente` contém "PESSOA" ou "FISICA"
3. **Melhorar filtros LIKE** para capturar variações de nomenclatura
4. **Somar propostas nos canais corretos** de acordo com o tipo_cliente

### Resultado Esperado

Após a implementação, o pedido de R$ 268,23 da IGREJA DO EVANGELHO QUADRANGULAR aparecerá no card **Igreja CNPJ**, pois:
- Está na tabela `ebd_shopify_pedidos_mercadopago`
- O cliente tem `tipo_cliente = 'IGREJA CNPJ'`
- O pedido tem `payment_status = 'approved'` e `status = 'PAGO'`

Todos os demais pedidos Mercado Pago também serão classificados corretamente nos seus respectivos cards.

