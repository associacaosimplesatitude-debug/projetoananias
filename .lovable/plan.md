

## Plano: Adicionar dados reais do pedido Bling aos destinatários

### 1. Migração — adicionar 3 colunas à tabela `whatsapp_campanha_destinatarios`

```sql
ALTER TABLE whatsapp_campanha_destinatarios 
  ADD COLUMN data_pedido text,
  ADD COLUMN produtos_pedido text,
  ADD COLUMN valor_pedido text;
```

### 2. Edge Function `bling-search-campaign-audience/index.ts`

- Ao iterar pedidos, capturar do objeto `pedido`: `data` (data do pedido), `totalProdutos` ou `total` (valor), e buscar itens via `/pedidos/vendas/{id}` apenas se necessário — ou extrair do campo `itens` se já presente na listagem.
- Como a listagem `/pedidos/vendas` provavelmente não inclui itens, a abordagem prática é: para cada contato único, guardar o **último pedido** associado e extrair `data` e `total` diretamente do objeto pedido (já disponível).
- Produtos: como a listagem não traz itens detalhados, usar uma string genérica ou, se viável, fazer uma chamada extra `/pedidos/vendas/{id}` para o pedido mais recente de cada contato (respeitando rate limit).
- Atualizar a interface `Contact` para incluir `data_pedido`, `produtos_pedido`, `valor_pedido`.

**Abordagem conservadora (sem chamada extra):** Extrair `pedido.data` e `pedido.total`/`pedido.totalProdutos` já disponíveis na listagem. Para produtos, usar fallback "seus produtos" até que o detalhe do pedido seja buscado (evita dobrar chamadas à API).

### 3. Frontend `WhatsAppCampaigns.tsx`

- Incluir `data_pedido`, `produtos_pedido`, `valor_pedido` no insert dos destinatários (linha ~234).
- Mapear os campos vindos do resultado da edge function.

### 4. Edge Function `whatsapp-send-campaign/index.ts`

- Já está mapeando `dest.data_pedido`, `dest.produtos_pedido`, `dest.valor_pedido` — nenhuma alteração necessária após a migração.

### Resumo de arquivos alterados
- **Migração SQL**: 3 colunas novas
- **`bling-search-campaign-audience/index.ts`**: capturar data e valor do pedido
- **`WhatsAppCampaigns.tsx`**: passar os novos campos no insert

