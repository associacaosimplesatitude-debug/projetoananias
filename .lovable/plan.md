
# Correção: Exibir Notas Emitidas de Ambas as Tabelas

## Problema Identificado

A página "Notas Emitidas" (`VendedorNotasEmitidas.tsx`) busca notas fiscais **apenas** da tabela `vendas_balcao`, mas muitos pedidos do vendedor (especialmente os criados via fluxo Shopify) estão na tabela `ebd_shopify_pedidos`.

### Fluxo Atual

```text
┌──────────────────────────────────────────────────────────────────┐
│                      FLUXO DE PEDIDOS                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   PDV Direto ─────────► vendas_balcao ◄─── Aparece na lista      │
│                                                                  │
│   Shopify/Faturamento ─► ebd_shopify_pedidos ◄── NÃO aparece     │
│                                                                  │
│   Pagar na Loja ──┬───► vendas_balcao (insert) ─► Deveria        │
│                   │                               aparecer       │
│                   └───► Mas insert pode falhar silenciosamente   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Por que as NF-es 019146 e 019147 não aparecem?

1. Os pedidos de teste foram criados no fluxo "Pagar na Loja" via Shopify
2. O código tenta inserir em `vendas_balcao` mas pode ter falhado
3. A NF-e é gerada no Bling com sucesso (019146, 019147)
4. Quando a NF-e tenta salvar no banco, não encontra registro com o `bling_order_id`
5. A página busca só de `vendas_balcao`, então notas não aparecem

---

## Solução

Modificar `VendedorNotasEmitidas.tsx` para buscar notas de **AMBAS** as tabelas e combinar os resultados.

### Alterações no arquivo `src/pages/vendedor/VendedorNotasEmitidas.tsx`

**1. Modificar a query para buscar de ambas as tabelas:**

```typescript
const { data: notas, isLoading, refetch, isRefetching } = useQuery({
  queryKey: ["notas-emitidas-vendedor", vendedor?.id],
  queryFn: async () => {
    if (!vendedor?.id) return [];
    
    // Buscar de vendas_balcao (PDV/Pagar na Loja)
    const { data: vendasBalcao, error: errorBalcao } = await supabase
      .from("vendas_balcao")
      .select(`
        id, bling_order_id, cliente_nome, cliente_cpf,
        cliente_telefone, valor_total, nota_fiscal_numero,
        nota_fiscal_chave, nota_fiscal_url, nfe_id, status_nfe, created_at
      `)
      .eq("vendedor_id", vendedor.id)
      .not("bling_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (errorBalcao) throw errorBalcao;

    // Buscar de ebd_shopify_pedidos (Pedidos Shopify com NF-e)
    const { data: pedidosShopify, error: errorShopify } = await supabase
      .from("ebd_shopify_pedidos")
      .select(`
        id, bling_order_id, customer_name, customer_phone,
        total_price, nota_fiscal_numero, nota_fiscal_chave,
        nota_fiscal_url, nfe_id, status_nfe, created_at
      `)
      .eq("vendedor_id", vendedor.id)
      .not("bling_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (errorShopify) throw errorShopify;

    // Mapear vendas_balcao para formato padrão
    const notasBalcao = vendasBalcao?.map(venda => ({
      id: venda.id,
      order_number: venda.bling_order_id?.toString() || venda.id.slice(0, 8),
      customer_name: venda.cliente_nome || "Cliente",
      customer_phone: venda.cliente_telefone,
      order_date: venda.created_at,
      nota_fiscal_numero: venda.nota_fiscal_numero,
      nota_fiscal_chave: venda.nota_fiscal_chave,
      nota_fiscal_url: venda.nota_fiscal_url,
      status_nfe: venda.status_nfe,
      nfe_id: venda.nfe_id,
      valor_total: venda.valor_total,
      source: 'balcao' as const,
    })) || [];

    // Mapear ebd_shopify_pedidos para formato padrão
    const notasShopify = pedidosShopify?.map(pedido => ({
      id: pedido.id,
      order_number: pedido.bling_order_id?.toString() || pedido.id.slice(0, 8),
      customer_name: pedido.customer_name || "Cliente",
      customer_phone: pedido.customer_phone,
      order_date: pedido.created_at,
      nota_fiscal_numero: pedido.nota_fiscal_numero,
      nota_fiscal_chave: pedido.nota_fiscal_chave,
      nota_fiscal_url: pedido.nota_fiscal_url,
      status_nfe: pedido.status_nfe,
      nfe_id: pedido.nfe_id,
      valor_total: parseFloat(pedido.total_price || '0'),
      source: 'shopify' as const,
    })) || [];

    // Combinar, remover duplicatas (mesmo bling_order_id), ordenar por data
    const allNotas = [...notasBalcao, ...notasShopify];
    const uniqueNotas = allNotas.reduce((acc, nota) => {
      const existing = acc.find(n => n.order_number === nota.order_number);
      if (!existing) {
        acc.push(nota);
      } else if (nota.nota_fiscal_numero && !existing.nota_fiscal_numero) {
        // Substituir se a nova tem NF-e e a existente não
        const index = acc.indexOf(existing);
        acc[index] = nota;
      }
      return acc;
    }, [] as typeof allNotas);

    return uniqueNotas.sort((a, b) => 
      new Date(b.order_date).getTime() - new Date(a.order_date).getTime()
    );
  },
  enabled: !!vendedor?.id,
});
```

**2. Atualizar a interface `NotaEmitida` para incluir source:**

```typescript
interface NotaEmitida {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string | null;
  order_date: string;
  nota_fiscal_numero: string | null;
  nota_fiscal_chave: string | null;
  nota_fiscal_url: string | null;
  status_nfe: string | null;
  nfe_id: number | null;
  valor_total?: number;
  source: 'balcao' | 'shopify';
}
```

**3. Atualizar a função `handleCheckNfeStatus` para atualizar ambas as tabelas:**

A função já chama a edge function `bling-check-nfe-status` que atualiza o banco. Ela precisa passar o `source` para saber qual tabela atualizar.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendedor/VendedorNotasEmitidas.tsx` | Buscar de ambas tabelas e combinar resultados |

---

## Resultado Esperado

Após a correção:
- Notas de pedidos feitos via PDV (vendas_balcao) aparecem
- Notas de pedidos feitos via Shopify (ebd_shopify_pedidos) também aparecem  
- Lista mostra TODAS as notas do vendedor, independente da origem
- Notas 019146 e 019147 (testes de hoje) aparecerão na lista
