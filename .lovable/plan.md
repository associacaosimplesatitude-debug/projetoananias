

# Correção: Pedido Penha chegando como "Em aberto" e NF-e sem vínculo

## Causa raiz encontrada

O comentário no próprio código confirma: **"O POST não aceita situacao nesta conta, então usamos PATCH após criar"** (linha 2685). O Bling ignora o campo `situacao` enviado no payload de criação.

Para pedidos **Faturamento B2B**, existe um PATCH para "Em andamento" logo após a criação (linha 2687-2712). Para pedidos **Mercado Pago**, existe um PATCH para "Aprovado" (linha 2717-2745).

Porém, para pedidos **pagamento_loja (Penha)**, o antigo PATCH para "Atendido" foi removido (corretamente), mas **nenhum PATCH para "Em andamento" foi adicionado no lugar**. O pedido fica com status "Em aberto" (default do Bling), e a herança simples na geração de NF-e pode falhar porque o status não é o esperado.

## Solução

### Arquivo: `supabase/functions/bling-create-order/index.ts`

Substituir o bloco de linhas 2748-2753 (que apenas loga que não vai aplicar "Atendido") por um PATCH para "Em andamento", seguindo o mesmo padrão usado para Faturamento B2B:

```
// Antes (atual - apenas log, sem PATCH):
if (createdOrderId && isPagamentoLoja && situacaoAtendidoId) {
  console.log('[BLING] Status "Atendido" NÃO será aplicado agora...');
}

// Depois (com PATCH para "Em andamento"):
if (createdOrderId && isPagamentoLoja && situacaoEmAndamentoId) {
  console.log('[BLING] Atualizando pedido para "Em andamento" - Pagamento Loja');
  await sleep(400);
  try {
    const updateResp = await fetch(
      `.../pedidos/vendas/${createdOrderId}/situacoes/${situacaoEmAndamentoId}`,
      { method: 'PATCH', headers: { Authorization, Accept } }
    );
    if (updateResp.ok) {
      console.log('[BLING] Status atualizado para "Em andamento" via PATCH');
    } else {
      console.warn('[BLING] Falha ao atualizar status via PATCH');
    }
  } catch (err) {
    console.warn('[BLING] Erro ao atualizar status:', err);
  }
}
```

Isso garante que o pedido esteja em "Em andamento" quando a `bling-generate-nfe` tentar a herança simples, permitindo que a NF-e seja vinculada ao pedido (o "V" laranja aparece).

Após a correção, fazer redeploy da função `bling-create-order`.

