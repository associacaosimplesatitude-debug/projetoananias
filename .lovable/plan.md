

# Correção: Vincular NF-e ao Pedido de Venda (mostrar "V" laranja) nos pedidos Penha

## Causa raiz

O fluxo atual do PDV Penha:
1. `bling-create-order` cria o Pedido de Venda
2. `bling-create-order` muda o status para "Atendido" via PATCH (linhas 2746-2773)
3. Frontend chama `bling-generate-nfe`
4. `bling-generate-nfe` tenta gerar NF-e, mas como o pedido ja esta "Atendido", a heranca simples (`{ idPedidoVenda }`) falha
5. A funcao cria NF-e com payload completo manual -- o Bling cria uma NF-e avulsa SEM vinculo ao pedido

Nos pedidos B2B: o status fica "Em andamento", a heranca funciona, e o "V" aparece.

## Solucao

Mudar a ordem das operacoes: gerar a NF-e via heranca simples ANTES de mudar o status para "Atendido".

### Alteracao 1: `supabase/functions/bling-create-order/index.ts`

Para pedidos `pagamento_loja` (PDV Penha), **nao** fazer o PATCH para "Atendido" dentro do `bling-create-order`. Em vez disso, retornar um flag `needs_atendido: true` na resposta para que o status seja atualizado depois da NF-e.

- Linhas 2746-2773: Envolver o bloco do PATCH "Atendido" em uma condicao que verifica se deve pular (ex: se `skip_atendido_patch` for true no payload, ou simplesmente remover o PATCH para pagamento_loja)
- Retornar `needs_atendido: true` junto com `bling_order_id` na resposta

### Alteracao 2: `supabase/functions/bling-generate-nfe/index.ts`

Mudar a estrategia de geracao para tentar heranca simples PRIMEIRO:

1. **Primeiro**: Tentar POST `/nfe` com apenas `{ idPedidoVenda: orderId }` (heranca simples)
2. **Se funcionar**: NF-e criada COM vinculo ao pedido (o "V" aparece)
3. **Se falhar** (ex: pedido Atendido, dados incompletos): Fallback para payload completo manual (comportamento atual)
4. **Apos gerar NF-e com sucesso**: Se recebeu flag ou detectou que e Penha, fazer PATCH do pedido para "Atendido"

Isso significa mover a logica de PATCH "Atendido" para DEPOIS da geracao da NF-e.

### Alteracao 3: `src/pages/vendedor/VendedorPDV.tsx`

Apos chamar `bling-generate-nfe`, se a NF-e foi gerada com sucesso e o pedido ainda nao esta "Atendido", fazer uma chamada adicional para atualizar o status. Isso pode ser feito:
- Passando o flag `needs_atendido` para `bling-generate-nfe` que cuidara do PATCH
- Ou adicionando uma chamada separada no frontend

### Detalhes tecnicos

**Em `bling-generate-nfe`:**
```
// NOVA ESTRATEGIA: Tentar heranca simples PRIMEIRO
const simplePayload = { idPedidoVenda: orderId };
const simpleResp = await fetch(createNfeUrl, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${accessToken}`, ... },
  body: JSON.stringify(simplePayload),
});

if (simpleResp.ok) {
  // Sucesso! NF-e vinculada ao pedido (V laranja)
  createNfeData = await simpleResp.json();
} else {
  // Fallback: payload completo (sem vinculo, mas NF-e e gerada)
  // ... codigo atual ...
}

// APOS GERAR NF-e: Atualizar pedido para "Atendido" se necessario
if (isLojaPenha) {
  await fetch(`/pedidos/vendas/${orderId}/situacoes/${situacaoAtendidoId}`, {
    method: 'PATCH', ...
  });
}
```

**Em `bling-create-order`:**
```
// Remover ou condicionar o bloco de PATCH "Atendido" (linhas 2746-2773)
// Para pagamento_loja, nao fazer PATCH aqui - sera feito apos NF-e
if (createdOrderId && isPagamentoLoja && situacaoAtendidoId) {
  // NAO fazer PATCH aqui - bling-generate-nfe fara apos gerar NF-e
  console.log('[BLING] Status "Atendido" sera aplicado apos geracao da NF-e');
}
```

## Resultado esperado

1. Pedido criado no Bling com status inicial (nao "Atendido")
2. NF-e gerada via heranca simples -- vinculada ao pedido ("V" laranja aparece)
3. Apos NF-e autorizada, pedido atualizado para "Atendido"
4. Vendedor aparece na NF-e pois herda os dados do pedido de venda

