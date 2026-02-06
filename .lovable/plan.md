
# Consolidação das Edge Functions Bling: Criação do Núcleo `api-bling`

## Contexto

O projeto atingiu o limite de estabilidade com **92 Edge Functions**, resultando em erros 404 constantes por falha de deploy. A consolidação é necessária para garantir estabilidade e manutenibilidade.

## Análise das Funções a Consolidar

### Funções Bling a Migrar

| Função Original | Linhas de Código | Chamadas no Front-end |
|-----------------|------------------|-----------------------|
| `bling-create-order` | ~2851 linhas | 8 arquivos |
| `bling-generate-nfe` | ~1455 linhas | 2 arquivos |
| `bling-check-stock` | ~250 linhas | 1 arquivo |
| `bling-sync-order-status` | ~321 linhas | Não chamado diretamente (cron) |

### Arquivos do Front-end que Precisam Refatoração

| Arquivo | Função Chamada |
|---------|----------------|
| `src/pages/ebd/CheckoutBling.tsx` | `bling-create-order` |
| `src/pages/admin/Orders.tsx` | `bling-create-order` |
| `src/pages/vendedor/VendedorPedidosPage.tsx` | `bling-create-order` |
| `src/pages/vendedor/VendedorPDV.tsx` | `bling-create-order`, `bling-generate-nfe` |
| `src/pages/shopify/ShopifyPedidos.tsx` | `bling-create-order` |
| `src/pages/ebd/Checkout.tsx` | `bling-create-order`, `bling-check-stock` |
| `src/pages/admin/AdminEBDPropostasPage.tsx` | `bling-create-order` |
| `src/components/shopify/VendaConcluidaDialog.tsx` | `bling-generate-nfe` |

---

## Plano de Implementação

### Tarefa 1: Criar o Núcleo `api-bling`

Criar uma nova Edge Function `supabase/functions/api-bling/index.ts` que centraliza as 4 lógicas usando um padrão de roteamento `switch(action)`.

**Estrutura proposta:**

```typescript
// v1.0.0 - Consolidação Bling
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Imports compartilhados (CORS, helpers, etc)
const corsHeaders = { ... };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { action, payload } = await req.json();

  switch (action) {
    case 'CREATE_ORDER':
      return handleCreateOrder(payload);
    case 'GENERATE_NFE':
      return handleGenerateNfe(payload);
    case 'CHECK_STOCK':
      return handleCheckStock(payload);
    case 'SYNC_ORDER_STATUS':
      return handleSyncOrderStatus(payload);
    default:
      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: corsHeaders }
      );
  }
});
```

**Código compartilhado a extrair:**
- `refreshBlingToken()` - renovação de token OAuth
- `isTokenExpired()` - verificação de expiração
- `corsHeaders` - headers CORS padrão
- Helpers fiscais (`extractFiscalError`, `resolveNaturezaOperacaoId`, etc.)

### Tarefa 2: Refatorar Chamadas no Front-end

Atualizar todos os componentes para usar o novo formato de payload:

**Antes:**
```typescript
await supabase.functions.invoke('bling-create-order', {
  body: { cliente, itens, forma_pagamento }
});
```

**Depois:**
```typescript
await supabase.functions.invoke('api-bling', {
  body: {
    action: 'CREATE_ORDER',
    payload: { cliente, itens, forma_pagamento }
  }
});
```

| Arquivo | Mudança |
|---------|---------|
| `CheckoutBling.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `Orders.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `VendedorPedidosPage.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `VendedorPDV.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `VendedorPDV.tsx` | `bling-generate-nfe` → `api-bling` + `action: 'GENERATE_NFE'` |
| `ShopifyPedidos.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `Checkout.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `Checkout.tsx` | `bling-check-stock` → `api-bling` + `action: 'CHECK_STOCK'` |
| `AdminEBDPropostasPage.tsx` | `bling-create-order` → `api-bling` + `action: 'CREATE_ORDER'` |
| `VendaConcluidaDialog.tsx` | `bling-generate-nfe` → `api-bling` + `action: 'GENERATE_NFE'` |

### Tarefa 3: Verificação

1. Deploy automático da nova função `api-bling`
2. Teste via `supabase.functions.invoke` para verificar status 200
3. **As funções antigas NÃO serão deletadas** - apenas desativadas no front-end

---

## Detalhes Técnicos

### Estrutura da Nova Função

```
supabase/functions/api-bling/
└── index.ts  (~4800 linhas consolidadas)
```

### Mapeamento de Ações

| Action | Função Original | Payload Esperado |
|--------|-----------------|------------------|
| `CREATE_ORDER` | `bling-create-order` | `{ cliente, itens, forma_pagamento, ... }` |
| `GENERATE_NFE` | `bling-generate-nfe` | `{ bling_order_id }` |
| `CHECK_STOCK` | `bling-check-stock` | `{ produtos }` |
| `SYNC_ORDER_STATUS` | `bling-sync-order-status` | `{ limit?, force? }` |

### Código Compartilhado (Helpers)

Os seguintes helpers serão definidos uma única vez no arquivo consolidado:

1. **refreshBlingToken()** - Renovação de token OAuth do Bling
2. **isTokenExpired()** - Verificação de expiração de token
3. **loadAllSituacoes()** - Cache de situações de pedido
4. **loadAllFormasPagamento()** - Cache de formas de pagamento
5. **resolveNaturezaOperacaoId()** - Resolução de natureza de operação
6. **extractFiscalError()** - Extração de erros fiscais
7. **getLastNfeNumber()** - Busca último número de NF-e

---

## Arquivos a Criar/Modificar

### Novos Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/api-bling/index.ts` | Nova função consolidada |

### Arquivos a Modificar (Front-end)
| Arquivo | Mudança |
|---------|---------|
| `src/pages/ebd/CheckoutBling.tsx` | Atualizar chamada |
| `src/pages/admin/Orders.tsx` | Atualizar chamadas |
| `src/pages/vendedor/VendedorPedidosPage.tsx` | Atualizar chamada |
| `src/pages/vendedor/VendedorPDV.tsx` | Atualizar 2 chamadas |
| `src/pages/shopify/ShopifyPedidos.tsx` | Atualizar chamada |
| `src/pages/ebd/Checkout.tsx` | Atualizar 2 chamadas |
| `src/pages/admin/AdminEBDPropostasPage.tsx` | Atualizar chamada |
| `src/components/shopify/VendaConcluidaDialog.tsx` | Atualizar chamada |

---

## Benefícios Esperados

1. **Redução de 4 funções para 1** - Menos funções para deployar
2. **Código compartilhado** - Helpers como `refreshBlingToken` definidos uma única vez
3. **Estabilidade** - Menos chance de 404 por falha de deploy
4. **Manutenibilidade** - Lógica Bling centralizada em um único lugar
5. **Consistência** - Padrão de chamada unificado no front-end
