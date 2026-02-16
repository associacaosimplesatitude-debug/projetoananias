

# Correcao definitiva + disparo manual do webhook

## Problema

A variavel `customerEmail` e declarada com `const` na linha 281, **dentro** do bloco `if (!finalVendedorId)` (linhas 277-373). O codigo de criacao de novo cliente na linha 378 esta **fora** desse bloco e nao consegue acessar a variavel -- causando `ReferenceError: customerEmail is not defined`.

Existem 3 declaracoes duplicadas de `customerEmail`:
- Linha 281 (dentro do bloco de heranca de vendedor)
- Linha 482 (dentro do bloco de propostas)
- Linha 579 (dentro do bloco de auto-provisioning)

## Correcao (1 unica acao)

Adicionar **uma unica declaracao** de `customerEmail` no escopo principal, logo apos `customerPhone` (linha 233):

```javascript
const customerEmail = order.email || order.customer?.email;
```

E converter as 3 declaracoes existentes (linhas 281, 482, 579) de `const customerEmail = ...` para simples comentarios ou remover, ja que a variavel estara disponivel no escopo superior.

## Disparo manual do webhook

Apos o deploy, chamar o webhook manualmente com os dados do pedido #2594 (order_id: 7160015159430, email: saudemaissimples@gmail.com, valor: 9.50, status: paid) para que o fluxo completo execute:

1. Criar registro em `ebd_clientes` (cliente novo)
2. Upsert do pedido em `ebd_shopify_pedidos`
3. Criar usuario Auth + senha temporaria
4. Disparar trigger do funil pos-venda (Fase 1)
5. Enviar WhatsApp de boas-vindas

## Secao Tecnica

- **Arquivo**: `supabase/functions/ebd-shopify-order-webhook/index.ts`
- **Linha 233**: Adicionar `const customerEmail = order.email || order.customer?.email;`
- **Linha 281**: Remover `const customerEmail = order.email || order.customer?.email;`
- **Linha 482**: Remover `const customerEmail = order.email || order.customer?.email;`
- **Linha 579**: Remover `const customerEmail = order.email || order.customer?.email;`
- **Deploy**: Automatico apos edicao
- **Webhook manual**: Chamar `ebd-shopify-order-webhook` via POST com payload simulando o pedido #2594 com topic `orders/paid`
- **Dados do pedido**: id=7160015159430, order_number=2594, email=saudemaissimples@gmail.com, financial_status=paid, total_price=9.50, customer: Byanca Soares, phone: 11969910179
