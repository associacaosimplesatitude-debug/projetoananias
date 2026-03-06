

## Plano: Aba "Públicos" no painel WhatsApp

### O que será feito

Criar uma nova aba **"Públicos"** em `/admin/whatsapp` que agrupa automaticamente clientes compradores de **Revistas EBD** por mês de compra. Cada público mensal mostra a quantidade de contatos e permite expandir para ver os detalhes completos do cliente e pedido (dados usados nas campanhas e templates WhatsApp).

### Funcionamento

1. **Agrupamento por mês**: Consulta `ebd_shopify_pedidos` + `ebd_shopify_pedidos_itens`, filtrando itens que são revistas (usando a mesma lógica de `categorizarProduto` de `categoriasShopify.ts`).
2. **Deduplica por email/telefone por mês**: Um cliente que comprou 3x em março aparece 1x no público de março (com dados do pedido mais recente).
3. **Mês atual é dinâmico**: Novos clientes que compram revistas entram automaticamente no público do mês corrente (sem necessidade de sync manual — é uma query em tempo real).
4. **Dados exibidos por contato**: nome, email, telefone, valor do pedido, data do pedido, produtos comprados (revistas), número do pedido, vendedor. Tudo que é necessário para campanhas e templates.

### Implementação

**Novo arquivo: `src/components/admin/WhatsAppPublicos.tsx`**

- Componente que faz query via RPC (função SQL) para buscar clientes de revistas agrupados por mês
- Interface com cards por mês (ex: "Março 2026 — 45 contatos") em ordem decrescente
- Ao clicar em um mês, expande uma tabela com todos os contatos e seus dados de pedido
- Botão "Usar em Campanha" (futuro) pode ser adicionado

**Nova migration: função SQL `get_publicos_revistas_por_mes`**

```sql
-- Retorna contatos únicos que compraram revistas, agrupados por mês
-- Para cada contato: nome, email, telefone, valor_pedido, data_pedido, 
-- produtos (revistas), order_number, vendedor_id
```

A função SQL faz:
1. JOIN `ebd_shopify_pedidos` com `ebd_shopify_pedidos_itens`
2. Filtra itens de revista (LIKE '%revista%', '%ebd%', '%estudo bíblico%', '%kit professor%', '%infografico%')
3. Filtra `status_pagamento = 'paid'`
4. Agrupa por `DATE_TRUNC('month', created_at)` e deduplica por email
5. Retorna mês, contagem e detalhes dos contatos

**Edição: `src/pages/admin/WhatsAppPanel.tsx`**

- Adicionar nova `TabsTrigger` "Públicos" com ícone `Users`
- Adicionar `TabsContent` renderizando `<WhatsAppPublicos />`

### Estrutura da UI

```text
┌─────────────────────────────────────────────┐
│  Aba: Públicos                              │
│                                             │
│  📋 Públicos de Compradores de Revistas     │
│  "Contatos agrupados por mês de compra"     │
│                                             │
│  ┌─ Março 2026 ──────────── 45 contatos ──┐ │
│  │  ▼ (expandível)                        │ │
│  │  Nome | Email | Tel | Valor | Data |   │ │
│  │  Produtos | Pedido | Vendedor          │ │
│  └────────────────────────────────────────┘ │
│  ┌─ Fevereiro 2026 ─────── 38 contatos ──┐ │
│  │  ► (colapsado)                         │ │
│  └────────────────────────────────────────┘ │
│  ┌─ Janeiro 2026 ────────── 52 contatos ──┐ │
│  └────────────────────────────────────────┘ │
│  ...                                        │
└─────────────────────────────────────────────┘
```

### Arquivos

- **Novo:** `src/components/admin/WhatsAppPublicos.tsx`
- **Editar:** `src/pages/admin/WhatsAppPanel.tsx` (adicionar aba)
- **Migration:** Função SQL `get_publicos_revistas_por_mes`

