

## Diagnóstico do Problema

Existem **dois caminhos** para gerar link de pagamento de uma proposta:

### 1. PropostaDigital.tsx (cliente confirmando a proposta) ✅ CORRETO
Quando o **cliente** acessa o link da proposta (`/proposta/[token]`) e confirma:
- Se **não é B2B** (`pode_faturar = false`): redireciona para `/ebd/checkout-shopify-mp` → **Mercado Pago** ✅
- Se **é B2B** (`pode_faturar = true`): aceita como faturamento direto ✅

### 2. VendedorPedidosPage.tsx → `processPaymentLink()` ❌ PROBLEMA
Quando o **vendedor** clica em "Gerar Link de Pagamento" no painel (`/vendedor/pedidos`):
- Chama `ebd-shopify-order-create` → cria **Draft Order no Shopify** → gera **Invoice URL do Shopify**
- O link salvo em `payment_link` é um link Shopify, **não** Mercado Pago

Isso explica porque o pedido #2737 foi para o Shopify: o vendedor Daniel gerou o link pelo painel, e o sistema criou um Draft Order no Shopify ao invés de redirecionar para Mercado Pago.

## Correção Proposta

Alterar `processPaymentLink()` no `VendedorPedidosPage.tsx` para:

1. **Parar de chamar** `ebd-shopify-order-create` 
2. **Ao invés disso**, atualizar a proposta com status `AGUARDANDO_PAGAMENTO` e gerar o link do checkout Mercado Pago (`/ebd/checkout-shopify-mp?proposta=[token]`)
3. O vendedor recebe o link MP para enviar ao cliente (ou copiar)

### Mudança técnica

**Arquivo:** `src/pages/vendedor/VendedorPedidosPage.tsx` — função `processPaymentLink()`

**De:** Chamar edge function `ebd-shopify-order-create` → Shopify Draft Order → Invoice URL

**Para:**
```typescript
const processPaymentLink = async (proposta: Proposta) => {
  // Atualizar status para AGUARDANDO_PAGAMENTO
  await supabase.from("vendedor_propostas")
    .update({ 
      status: "AGUARDANDO_PAGAMENTO",
      payment_link: `${window.location.origin}/ebd/checkout-shopify-mp?proposta=${proposta.token}`
    })
    .eq("id", proposta.id);
  
  // Abrir checkout MP em nova aba
  window.open(`/ebd/checkout-shopify-mp?proposta=${proposta.token}`, '_blank');
};
```

### Mesma correção em:
- **`src/pages/admin/AdminEBDPropostasPage.tsx`** — mesma lógica de `processPaymentLink` que também chama `ebd-shopify-order-create`
- **`src/pages/shopify/ShopifyPedidos.tsx`** — se houver botão similar para propostas

### Exceção B2B (Faturamento Direto)
O fluxo de faturamento B2B (`pode_faturar = true`) pode continuar usando `ebd-shopify-order-create` pois esses pedidos são faturados diretamente, sem pagamento online.

