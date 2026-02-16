

# Correção: Exibir Código de Rastreio do Bling nos Pedidos

## Problema Identificado

Os códigos de rastreio vindos da integração com o Bling estão sendo salvos corretamente no campo `codigo_rastreio_bling`, mas o frontend exibe apenas o campo `codigo_rastreio` (do Shopify), que está vazio para todos os pedidos. Resultado: a coluna "Rastreio" mostra "-" mesmo com rastreio disponível.

**Dados confirmados no banco:**
- Pedido #2266: `codigo_rastreio` = null, `codigo_rastreio_bling` = AB932227694BR
- Pedido #2259: `codigo_rastreio` = null, `codigo_rastreio_bling` = AN488374125BR
- (Todos os pedidos pagos seguem este padrão)

## Solução

Alterar o frontend para usar `codigo_rastreio_bling` como fallback quando `codigo_rastreio` estiver vazio. A prioridade sera: Shopify > Bling.

---

## Arquivos a Alterar

### 1. `src/components/vendedor/VendedorPedidosTab.tsx`

**Interface ShopifyPedido** (linha ~59): Adicionar `codigo_rastreio_bling` ao tipo.

**Coluna Rastreio na tabela** (linha ~743): Alterar a logica para usar `pedido.codigo_rastreio || pedido.codigo_rastreio_bling` em vez de apenas `pedido.codigo_rastreio`.

Mesma correção na segunda tabela de pedidos cancelados/pendentes (linha ~1031).

### 2. `src/components/vendedor/ShopifyPedidoDetailDialog.tsx`

**Interface ShopifyPedido** (linha ~28): Adicionar `codigo_rastreio_bling` ao tipo.

**Secao Rastreamento** (linha ~194): Alterar para exibir `pedido.codigo_rastreio || pedido.codigo_rastreio_bling`, e gerar URL de rastreio dos Correios automaticamente se for codigo Bling (formato BR).

### 3. `src/components/admin/AdminPedidosTab.tsx`

Mesma correção de fallback para a interface e exibicao na tabela admin.

---

## Secao Tecnica

### Logica de fallback

```typescript
// Prioridade: Shopify > Bling
const trackingCode = pedido.codigo_rastreio || pedido.codigo_rastreio_bling;
const trackingUrl = pedido.url_rastreio || 
  (pedido.codigo_rastreio_bling 
    ? `https://www.linkcorreios.com.br/?id=${pedido.codigo_rastreio_bling}` 
    : null);
```

### Resultado esperado

- Pedidos com rastreio do Bling passarao a exibir o codigo como link clicavel para rastreamento nos Correios
- Se o Shopify eventualmente fornecer rastreio, ele tera prioridade sobre o do Bling
- Nenhuma alteracao no backend necessaria - os dados ja estao corretos no banco

