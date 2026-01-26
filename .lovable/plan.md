
## Plano: Corrigir Sincronização de Links DANFE no Painel de Comissões

### Problema Identificado

Após análise detalhada do código e dos dados:

1. **22 parcelas liberadas** possuem `bling_order_id` mas estão sem `link_danfe`
2. A maioria são pedidos de origem `mercadopago` 
3. Os botões de sincronização existem no painel, mas a edge function `sync-nf-danfe-batch` não está buscando corretamente as NF-e dessas parcelas

### Causa Raiz

A edge function `sync-nf-danfe-batch` filtra apenas parcelas com `bling_order_id` OU parcelas que tenham um `shopify_pedido` vinculado. Porém, para pedidos Mercado Pago, as parcelas:
- Têm `bling_order_id` diretamente (funcionaria ✓)
- **Não têm `shopify_pedido_id`** (não é um problema)

O problema real é que a NF-e no Bling pode estar:
1. Ainda não gerada (situação != 6)
2. Sem o campo `linkDanfe` disponível na resposta API
3. O ID da NF-e não está sendo encontrado no objeto de retorno do pedido

### Solução Proposta

#### 1. Melhorar a Edge Function `sync-nf-danfe-batch`

**Arquivo:** `supabase/functions/sync-nf-danfe-batch/index.ts`

Alterações:
- Adicionar mais caminhos de busca para o ID da NF-e na resposta do Bling
- Melhorar o fallback do `linkDanfe` verificando mais campos possíveis
- Adicionar logs detalhados para entender por que as NF-e não estão sendo encontradas
- Retornar detalhes dos erros específicos por pedido

```typescript
// Melhorar busca de nfeId - verificar mais caminhos
let nfeId: number | null = null;

// 1. notasFiscais array (mais comum)
if (orderData.notasFiscais?.length > 0) {
  nfeId = orderData.notasFiscais[0]?.id;
}

// 2. notaFiscal objeto
if (!nfeId && orderData.notaFiscal?.id) {
  nfeId = orderData.notaFiscal.id;
}

// 3. nfe objeto
if (!nfeId && orderData.nfe?.id) {
  nfeId = orderData.nfe.id;
}

// 4. Buscar via endpoint de notas fiscais do pedido
if (!nfeId) {
  const nfesUrl = `https://www.bling.com.br/Api/v3/nfe?idPedidoVenda=${blingOrderId}`;
  const nfesResult = await blingApiCall(nfesUrl, accessToken);
  if (nfesResult?.data?.length > 0) {
    nfeId = nfesResult.data[0]?.id;
  }
}
```

#### 2. Melhorar busca do Link DANFE

```typescript
// Melhorar fallback de linkDanfe
const linkDanfe = 
  nfeData.linkDanfe || 
  nfeData.link_danfe || 
  nfeData.linkPDF ||
  nfeData.xml?.danfe ||
  nfeData.pdf ||
  null;
```

#### 3. Adicionar endpoint alternativo de busca de NF-e

A API do Bling v3 permite buscar NF-e diretamente pelo ID do pedido de venda:
```
GET /nfe?idPedidoVenda={blingOrderId}
```

Isso garante que mesmo se o campo `notasFiscais` estiver vazio no objeto do pedido, ainda podemos encontrar a NF-e.

#### 4. Logs de Auditoria

Adicionar na resposta um array detalhado de erros:
```typescript
results.errors.push({ 
  id: parcela.id, 
  bling_order_id: blingOrderId,
  error: nfeResult.error,
  nfe_situacao: nfeResult.situacao  // Para debug
});
```

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/sync-nf-danfe-batch/index.ts` | Adicionar busca alternativa de NF-e via endpoint `/nfe?idPedidoVenda=` |

### Resultado Esperado

Após implementação:
1. O botão "Sincronizar NF/DANFE" no painel irá sincronizar corretamente
2. Pedidos Mercado Pago com NF-e autorizada terão o link DANFE visível
3. Erros detalhados serão exibidos para pedidos cujas NF-e ainda não estão disponíveis (aguardando autorização)

### Alternativa: Sincronização Manual

Para casos específicos onde a sincronização automática falha, o botão "Vincular" manual já existe no painel e permite associar manualmente o `bling_order_id` e o `link_danfe`.
