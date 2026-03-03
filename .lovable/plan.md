

## Diagnóstico

Os logs confirmam que:
- A API do Bling **retorna pedidos** (páginas 1 e 2 têm dados, página 3 vazia = `done`)
- Mas **0 contatos são extraídos** de todos os pedidos

O código atual acessa `pedido.contato` — mas na API Bling v3 `/pedidos/vendas`, o campo do cliente é provavelmente `pedido.contato` com estrutura diferente ou outro nome (ex: `pedido.cliente`, `pedido.contato.id` sem dados inline).

**O problema não é de conexão — é de mapeamento de dados.**

## Plano

### 1. Adicionar log do primeiro pedido retornado

No arquivo `supabase/functions/bling-search-campaign-audience/index.ts`, logo após `const pedidos = json.data || [];`, adicionar:

```typescript
if (pedidos.length > 0 && page <= 2) {
  console.log("=== AMOSTRA PEDIDO (página " + page + ") ===");
  console.log(JSON.stringify(pedidos[0], null, 2));
  console.log("=== FIM AMOSTRA ===");
}
```

Isso logará a estrutura completa do primeiro pedido, revelando exatamente onde estão os dados do contato.

### 2. Deploy e teste

Redeployar a função, executar uma busca, e ler os logs para ver a estrutura real do pedido Bling v3.

### 3. Corrigir mapeamento

Com base na estrutura real, ajustar o acesso aos campos (ex: `pedido.contato.nome` → campo correto).

**Nenhuma lógica será alterada além do log de diagnóstico no passo 1. A correção do mapeamento só será feita após confirmar a estrutura.**

