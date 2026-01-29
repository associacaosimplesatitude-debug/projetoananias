

# Correção: NF-e não está sendo gerada para vendas do PDV Balcão

## Problema Identificado

A NF-e da **IGREJA BATISTA DA LIBERTAÇAO** não foi gerada porque o fluxo do PDV Balcão **não inclui a geração automática de NF-e**.

### Análise dos Logs

| Dado | Valor |
|------|-------|
| Pedido Bling | `24953213924` |
| Cliente | IGREJA BATISTA DA LIBERTAÇAO |
| Valor | R$ 381,98 (com 20% desconto) |
| `nfe_id` no banco | `null` |
| `status_nfe` | `CRIADA` |

O log da `bling-generate-nfe` mostrou que a NF-e #019159 foi gerada para **outro cliente** (IGREJA ASSEMBLEIA DE DEUS MINISTERIO ARCA DA ALIANCA, pedido `24953350435`), não para a IG BATISTA DA LIBERTAÇAO.

### Causa Raiz

O fluxo atual do PDV Balcão (VendedorPDV.tsx) faz:
1. ✅ Cria pedido no Bling via `bling-create-order`
2. ✅ Atualiza status para "Atendido" automaticamente
3. ❌ **NÃO chama** `bling-generate-nfe` para emitir a NF-e

A NF-e deveria ser gerada automaticamente após a criação do pedido no Bling, mas isso não está acontecendo.

## Solução

Adicionar a chamada à função `bling-generate-nfe` no fluxo do PDV Balcão, logo após o pedido ser criado com sucesso no Bling.

### Modificação em `src/pages/vendedor/VendedorPDV.tsx`

Após receber o `bling_order_id` do `bling-create-order`, chamar imediatamente a geração da NF-e:

```typescript
// Após criar pedido no Bling com sucesso
const blingData = blingResponse.data;

if (blingData?.bling_order_id) {
  // Gerar NF-e automaticamente
  console.log(`[PDV] Gerando NF-e para pedido Bling ${blingData.bling_order_id}`);
  
  const nfeResponse = await supabase.functions.invoke('bling-generate-nfe', {
    body: { bling_order_id: blingData.bling_order_id }
  });
  
  if (nfeResponse.data?.nfe_id) {
    console.log(`[PDV] NF-e gerada: ${nfeResponse.data.nfe_numero}`);
    // O bling-generate-nfe já atualiza o vendas_balcao com nfe_id
  } else if (nfeResponse.data?.nfe_pendente) {
    console.log(`[PDV] NF-e em processamento, será atualizada via polling`);
  } else {
    console.warn(`[PDV] Erro ao gerar NF-e:`, nfeResponse.data?.fiscal_error || nfeResponse.error);
  }
}
```

### Fluxo Corrigido

```
1. Vendedora finaliza venda no PDV Balcão
2. Sistema cria pedido no Bling → bling_order_id retornado
3. Sistema salva em vendas_balcao com bling_order_id
4. [NOVO] Sistema chama bling-generate-nfe com o bling_order_id
5. NF-e é criada e enviada à SEFAZ
6. vendas_balcao é atualizado com nfe_id, nota_fiscal_numero, etc.
7. Vendedora vê a nota na tela "Notas Emitidas"
```

### Tratamento de Erros

Se a NF-e não for autorizada imediatamente (situação 5 - processando):
- O `bling-generate-nfe` já salva `status_nfe = 'PROCESSANDO'` e `nfe_id` no banco
- A vendedora pode clicar em "Atualizar" na tela de Notas Emitidas para verificar o status

### UI Feedback

Mostrar feedback visual durante a geração da NF-e:
- "Criando pedido no Bling..." 
- "Gerando Nota Fiscal..."
- "✓ Nota Fiscal #019159 emitida com sucesso!"

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendedor/VendedorPDV.tsx` | Adicionar chamada a `bling-generate-nfe` após criação do pedido |

## Resultado Esperado

Após essa correção:
- Toda venda do PDV Balcão terá NF-e gerada automaticamente
- O `nfe_id` será salvo corretamente no banco
- A vendedora verá a nota na tela "Notas Emitidas" imediatamente ou após atualizar

