
# Atualização do Consultor de BI - Estrutura de Dados de Vendas

## Problema Identificado

O Consultor de BI não consegue responder perguntas sobre vendas de vendedores porque seu conhecimento de banco de dados está **incompleto e desatualizado**. Ele não conhece todas as tabelas onde vendas são armazenadas.

## Estrutura Real de Vendas do Sistema

O sistema armazena vendas em **4 tabelas diferentes**, dependendo do canal de venda:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FONTES DE VENDAS POR VENDEDOR                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. vendedor_propostas          →  Pedidos B2B (Faturamento 30/60/90)  │
│      - Identificador: vendedor_id ou vendedor_email                     │
│      - Status concluído: FATURADO, PAGO                                 │
│      - 315 registros, 64 faturados                                      │
│                                                                         │
│   2. ebd_shopify_pedidos         →  Pedidos Shopify (Loja Online)       │
│      - Identificador: vendedor_id                                       │
│      - Status concluído: paid, Faturado                                 │
│      - 1.496 registros, 1.383 pagos                                     │
│                                                                         │
│   3. ebd_shopify_pedidos_mercadopago →  Pagamentos Digitais (PIX/Cartão)│
│      - Identificador: vendedor_id ou vendedor_email                     │
│      - Status concluído: PAGO                                           │
│      - 167 registros, 46 pagos                                          │
│                                                                         │
│   4. vendas_balcao               →  PDV / Pagar na Loja (Penha)         │
│      - Identificador: vendedor_id                                       │
│      - Status concluído: finalizada                                     │
│      - 50 registros                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Exemplo de Consulta Correta

Para responder "Quais as vendas da Gloria Carreiro?":

```sql
-- Precisa consultar TODAS as 4 tabelas e somar
SELECT 'Propostas B2B' as fonte, COUNT(*) as qtd, SUM(valor_total) as valor
FROM vendedor_propostas 
WHERE vendedor_email = 'glorinha21carreiro@gmail.com' AND status IN ('FATURADO', 'PAGO')

UNION ALL

SELECT 'Shopify', COUNT(*), SUM(valor_total)
FROM ebd_shopify_pedidos esp
JOIN vendedores v ON esp.vendedor_id = v.id
WHERE v.email = 'glorinha21carreiro@gmail.com' AND esp.status_pagamento = 'paid'

UNION ALL

SELECT 'Mercado Pago', COUNT(*), SUM(valor_total)
FROM ebd_shopify_pedidos_mercadopago
WHERE vendedor_email = 'glorinha21carreiro@gmail.com' AND status = 'PAGO'

UNION ALL

SELECT 'PDV/Balcão', COUNT(*), SUM(valor_total)
FROM vendas_balcao vb
JOIN vendedores v ON vb.vendedor_id = v.id
WHERE v.email = 'glorinha21carreiro@gmail.com' AND vb.status = 'finalizada'
```

## Alterações Necessárias

### Arquivo: `supabase/functions/gemini-assistente-gestao/index.ts`

Atualizar o `SYSTEM_PROMPT` para incluir:

1. **Documentação completa das 4 tabelas de vendas**
2. **Campos corretos da tabela `vendedores`** (status = 'ativo', não is_active)
3. **Status que indicam venda concluída em cada tabela**
4. **Orientação para JOIN** quando buscar por email em vez de vendedor_id
5. **Exemplos de queries para vendas totais**

### Novo SYSTEM_PROMPT (principais adições)

```typescript
const SYSTEM_PROMPT = `Você é o Consultor de BI da Editora Central Gospel...

## IMPORTANTE: Fontes de Vendas

Para consultar vendas de um vendedor, você DEVE consultar TODAS estas tabelas:

### 1. vendedor_propostas (Pedidos B2B/Faturamento)
- Campos: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome, 
          valor_total, status, bling_status_id, bling_order_id, created_at
- Status de venda concluída: 'FATURADO', 'PAGO'
- Identificar vendedor por: vendedor_id ou vendedor_email

### 2. ebd_shopify_pedidos (Pedidos Shopify/Online)
- Campos: id, shopify_order_id, vendedor_id, cliente_id, valor_total, valor_para_meta,
          status_pagamento, customer_name, customer_email, created_at, 
          bling_order_id, nota_fiscal_numero, nota_fiscal_url
- Status de venda concluída: 'paid', 'Faturado'
- Identificar vendedor por: vendedor_id (fazer JOIN com vendedores para filtrar por email)

### 3. ebd_shopify_pedidos_mercadopago (Pagamentos Digitais PIX/Cartão)
- Campos: id, vendedor_id, vendedor_email, vendedor_nome, cliente_id, cliente_nome,
          valor_total, status, payment_status, payment_method, mercadopago_payment_id, created_at
- Status de venda concluída: 'PAGO'
- Identificar vendedor por: vendedor_id ou vendedor_email

### 4. vendas_balcao (PDV / Pagar na Loja)
- Campos: id, vendedor_id, polo, cliente_nome, cliente_cpf, valor_total, 
          forma_pagamento, status, bling_order_id, nota_fiscal_numero, created_at
- Status de venda concluída: 'finalizada'
- Identificar vendedor por: vendedor_id (fazer JOIN com vendedores para filtrar por email)

### 5. vendedores (Cadastro de Vendedores)
- Campos: id, nome, email, email_bling, status, tipo_perfil, is_gerente, gerente_id, 
          comissao_percentual, meta_mensal_valor
- Filtro para ativos: status = 'ativo'

## Como Buscar Vendas Totais de um Vendedor

Para responder perguntas como "Vendas do vendedor X", faça queries em TODAS as 4 tabelas:

1. Primeiro busque o vendedor_id pelo nome ou email na tabela vendedores
2. Depois consulte cada tabela de vendas usando vendedor_id ou vendedor_email
3. Some os resultados para ter o total

Exemplo para buscar vendedor:
SELECT id, nome, email FROM vendedores WHERE nome ILIKE '%gloria%' OR email ILIKE '%gloria%'
`;
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/gemini-assistente-gestao/index.ts` | Atualizar SYSTEM_PROMPT com documentação completa das 4 tabelas de vendas, campos corretos, status, e exemplos de queries |

## Resultado Esperado

Após a atualização, o Consultor de BI conseguirá:
- ✅ Responder corretamente "Quais as vendas do vendedor X?"
- ✅ Consultar todas as fontes de vendas (B2B, Shopify, Mercado Pago, PDV)
- ✅ Identificar vendedores por nome, email ou ID
- ✅ Saber os status que indicam venda concluída em cada tabela
- ✅ Fazer JOINs quando necessário para cruzar dados
