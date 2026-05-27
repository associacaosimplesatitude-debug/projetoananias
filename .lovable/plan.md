## Diagnóstico

A cliente **Suellen** (`b3ff9feb-…`, telefone 21997043519) e o cliente **Pedro Augusto Rodrigues Pereira** (`9693ca08-…`, CNPJ 30973042000170) estão no banco com `pode_faturar = false` em `ebd_clientes`. Mesmo assim o modal “Forma de Pagamento” aparece e ambos conseguem clicar em **Faturar Pedido (B2B)**.

O modal do print é o `FaturamentoSelectionDialog` (`src/components/shopify/FaturamentoSelectionDialog.tsx`), aberto a partir de `src/pages/shopify/ShopifyPedidos.tsx` no fluxo do checkout do carrinho.

### Causa raiz

Em `src/pages/shopify/ShopifyPedidos.tsx`, dentro do handler de finalizar carrinho (linhas 517–524):

```ts
// Se tem cliente selecionado (superintendente logado com cadastro)
if (!isVendedor && selectedCliente) {
  setShowFaturamentoDialog(true);   // ❌ NÃO checa pode_faturar
  return;
}
```

O dialog é aberto **sempre** que um superintendente logado tem cadastro vinculado, sem olhar a flag `pode_faturar`. Para o caminho do vendedor, a checagem existe corretamente (linha 542: `if (selectedCliente.pode_faturar || canUseFreteManual)`), mas no caminho do superintendente ela foi esquecida.

Resultado: qualquer cliente logado (B2B desativado ou não) vê o modal e o botão “Faturar Pedido (B2B)”.

## Correção (escopo mínimo, só frontend)

Único arquivo alterado: `src/pages/shopify/ShopifyPedidos.tsx`, bloco das linhas 517–524.

Trocar:

```ts
if (!isVendedor && selectedCliente) {
  setShowFaturamentoDialog(true);
  return;
}
```

por:

```ts
if (!isVendedor && selectedCliente) {
  if (selectedCliente.pode_faturar) {
    // Cliente B2B habilitado: pode escolher Faturar ou Pagamento Padrão
    setShowFaturamentoDialog(true);
    return;
  }
  // Cliente sem B2B: cai no fluxo padrão (checkout normal logo abaixo)
}
```

Assim, quando `pode_faturar = false`, o código segue para a rota de checkout padrão já existente para cliente final (`handleCreateDraftOrder(...)` mais abaixo), exatamente como acontece para clientes sem cadastro.

Nada mais é tocado: nenhuma mudança em RLS, no Bling, no dialog em si, no caminho do vendedor ou em outras telas.

## Validação

1. Logar como **Suellen** (`pode_faturar = false`), adicionar item ao carrinho e finalizar → deve ir direto para o checkout padrão; o modal “Forma de Pagamento / Faturar Pedido (B2B)” não deve aparecer.
2. Logar como **Pedro Augusto Rodrigues Pereira** (`pode_faturar = false`) → mesmo comportamento, sem modal de faturamento.
3. Logar como um cliente com `pode_faturar = true` → modal continua aparecendo normalmente com as duas opções.
4. Fluxo do vendedor não muda: para clientes com `pode_faturar = true` o modal continua aparecendo; para os demais segue a lógica atual de descontos.
