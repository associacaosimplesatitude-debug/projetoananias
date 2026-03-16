

## Plano: Corrigir fluxo de status do pedido Loja Penha para vínculo NF-e ↔ Pedido

### Problema
Pedidos da Loja Penha são criados com status "Atendido" (linha 894 de `bling-create-order`). A API v3 do Bling ignora `idPedidoVenda` no `POST /nfe` quando o pedido já está "Atendido". O `PUT /nfe/{id}` com `idPedidoVenda` não é suportado (HTTP 400).

### Solução
1. Criar pedido como "Em andamento" (não "Atendido")
2. Após NF-e autorizada, mover para "Atendido" via PATCH
3. Remover o PUT inútil

---

### Alteração 1: `supabase/functions/bling-create-order/index.ts`

**Linhas 893-898** — Mudar status inicial de `isPagamentoLoja`:

```typescript
// ANTES:
const situacaoInicialId = isPagamentoLoja 
  ? situacaoAtendidoId  // Pagar na Loja (Glorinha) → "Atendido" (já foi pago)
  : isFaturamentoPagamento 
    ? (situacaoEmAndamentoId || situacaoEmAbertoId)
    : situacaoEmAbertoId;

// DEPOIS:
const situacaoInicialId = isPagamentoLoja 
  ? (situacaoEmAndamentoId || situacaoEmAbertoId)  // Pagar na Loja → "Em andamento" (será movido para "Atendido" após NF-e autorizada)
  : isFaturamentoPagamento 
    ? (situacaoEmAndamentoId || situacaoEmAbertoId)
    : situacaoEmAbertoId;
```

Atualizar também o log na linha 900-902 para refletir a nova lógica.

---

### Alteração 2: `supabase/functions/bling-generate-nfe/index.ts`

**Remover linhas 1116-1135** — Bloco `PUT` de vinculação que retorna HTTP 400.

**Adicionar após NF-e autorizada (dentro do bloco `situacao === 6`, linha ~1293-1337)** — Após salvar no banco e antes do `return`, adicionar PATCH para mover pedido para "Atendido":

```typescript
// Mover pedido para "Atendido" após NF-e autorizada
if (orderId) {
  try {
    // Buscar ID da situação "Atendido" dinamicamente
    const situacoesUrl = 'https://www.bling.com.br/Api/v3/situacoes/modulo/pedidos_venda';
    const situacoesResp = await fetch(situacoesUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
    });
    let situacaoAtendidoId = 9; // fallback
    if (situacoesResp.ok) {
      const situacoesData = await situacoesResp.json();
      const situacoes = Array.isArray(situacoesData?.data) ? situacoesData.data : [];
      const atendido = situacoes.find((s: any) => 
        String(s?.nome || '').toLowerCase().trim() === 'atendido'
      );
      if (atendido?.id) situacaoAtendidoId = atendido.id;
    }

    const patchResp = await fetch(
      `https://api.bling.com.br/Api/v3/pedidos/vendas/${orderId}/situacoes`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idSituacao: situacaoAtendidoId }),
      }
    );
    console.log(`[BLING-NFE] PATCH pedido ${orderId} → Atendido (ID ${situacaoAtendidoId}): HTTP ${patchResp.status}`);
  } catch (patchError) {
    console.error(`[BLING-NFE] Falha ao mover pedido para Atendido:`, patchError);
  }
}
```

---

### Alteração 3: Deploy

Deploy de ambas as Edge Functions: `bling-create-order` e `bling-generate-nfe`.

---

### Nota técnica
- O endpoint correto para mudar situação de pedido no Bling v3 é `PATCH /pedidos/vendas/{id}/situacoes` com body `{ idSituacao: <id> }`.
- A busca de situações já existe no `bling-create-order` — no `bling-generate-nfe` precisamos fazer uma chamada adicional pois a função não carrega situações atualmente.
- O bloco PATCH está em try/catch para não bloquear o retorno de sucesso da NF-e.

