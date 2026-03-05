

## Plano: Corrigir fluxo de pagamento do vendedor para usar Mercado Pago

### Problema encontrado

Existem **dois caminhos** para gerar pagamento de uma proposta:

1. **Página da proposta** (`/proposta/:token` — `PropostaDigital.tsx`) — Já redireciona corretamente para o checkout Mercado Pago (linhas 573-598). Funciona bem.

2. **Painel do vendedor** (`VendedorPedidosPage.tsx` — função `processPaymentLink`, linhas 396-461) — **Ainda chama `ebd-shopify-order-create`**, criando um Draft Order no Shopify. Este é o bug.

Quando o vendedor clica "Gerar Link de Pagamento" no painel dele, o sistema cria um pedido Shopify em vez de direcionar para o Mercado Pago. Foi assim que o pedido da Renata/Elaine foi parar no Shopify.

### Solução

**Arquivo: `src/pages/vendedor/VendedorPedidosPage.tsx`**

Reescrever a função `processPaymentLink` (linhas 396-461) para:

1. **Não chamar** `ebd-shopify-order-create` (remover essa chamada).
2. Em vez disso, atualizar a proposta para `AGUARDANDO_PAGAMENTO` e gerar o link de checkout interno do Mercado Pago: `/ebd/checkout-shopify-mp?proposta={token}`.
3. Copiar automaticamente o link para a área de transferência do vendedor (para que ele envie ao cliente).
4. Abrir o link em nova aba como preview opcional.

```tsx
// ANTES (bug):
const { data, error } = await supabase.functions.invoke('ebd-shopify-order-create', { ... });
const cartUrl = data?.cartUrl || data?.invoiceUrl;
window.open(cartUrl, '_blank');

// DEPOIS (correto):
await supabase.from("vendedor_propostas")
  .update({ status: "AGUARDANDO_PAGAMENTO", payment_link: null })
  .eq("id", proposta.id);
const checkoutUrl = `https://gestaoebd.com.br/ebd/checkout-shopify-mp?proposta=${proposta.token}`;
await navigator.clipboard.writeText(checkoutUrl);
toast.success("Link de pagamento copiado!");
```

### Resultado

- Propostas de vendedores **nunca mais** criam Draft Orders no Shopify.
- Todos os pagamentos digitais passam pelo checkout interno do Mercado Pago.
- O fluxo B2B (faturamento) continua inalterado — vai para aprovação financeira normalmente.

