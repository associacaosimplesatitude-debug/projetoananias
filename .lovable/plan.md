
# Plano: Corrigir Atribuição de Vendedor e Adicionar Filtros

## Problema Identificado

O vendedor **está sendo salvo corretamente**, mas o pedido **desaparece da lista** porque a query atual só mostra pedidos sem vendedor atribuído (`.is("vendedor_id", null)`). Isso dá a impressão de que "não está fixando".

## Soluções a Implementar

### 1. Corrigir a Lógica da Query para Mostrar Todos os Pedidos

Remover o filtro fixo `.is("vendedor_id", null)` e usar filtros dinâmicos controlados pelo usuário.

### 2. Adicionar Filtros na Interface

| Filtro | Opções |
|--------|--------|
| Status Atribuição | Todos, Atribuídos, Não Atribuídos |
| Vendedor | Todos os vendedores ativos |

### 3. Adicionar Barra de Rolagem no Modal

Envolver o conteúdo do dialog em um `ScrollArea` com altura máxima para permitir rolagem quando o conteúdo é extenso.

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/shopify/PedidosOnline.tsx` | Adicionar filtros e modificar query |
| `src/components/admin/PedidoOnlineDetailDialog.tsx` | Adicionar ScrollArea no conteúdo |

### Alterações em PedidosOnline.tsx

**1. Adicionar novos estados para filtros:**
```typescript
const [atribuicaoFilter, setAtribuicaoFilter] = useState<"all" | "atribuido" | "nao_atribuido">("nao_atribuido");
const [vendedorFilter, setVendedorFilter] = useState<string>("all");
```

**2. Adicionar query para buscar lista de vendedores:**
```typescript
const { data: vendedores = [] } = useQuery({
  queryKey: ["vendedores-ativos-filter"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("vendedores")
      .select("id, nome")
      .eq("status", "Ativo")
      .order("nome");
    if (error) throw error;
    return data;
  },
});
```

**3. Modificar a query principal para remover filtro fixo:**
```typescript
const { data: pedidos, isLoading } = useQuery({
  queryKey: ["ebd-shopify-pedidos-online"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("ebd_shopify_pedidos")
      .select(`
        *,
        cliente:ebd_clientes(nome_igreja, tipo_cliente),
        vendedor:vendedores(nome)
      `)
      .neq("status_pagamento", "Faturado")
      .gte("created_at", "2025-12-01T00:00:00.000Z")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data as ShopifyPedido[]).filter((p) => isPaidStatus(p.status_pagamento));
  },
});
```

**4. Adicionar filtro client-side por atribuição e vendedor:**
```typescript
const filteredByAtribuicao = useMemo(() => {
  if (!filteredByDate) return [];
  
  let result = filteredByDate;
  
  // Filtro por atribuição
  if (atribuicaoFilter === "atribuido") {
    result = result.filter((p) => p.vendedor_id !== null);
  } else if (atribuicaoFilter === "nao_atribuido") {
    result = result.filter((p) => p.vendedor_id === null);
  }
  
  // Filtro por vendedor específico
  if (vendedorFilter !== "all") {
    result = result.filter((p) => p.vendedor_id === vendedorFilter);
  }
  
  return result;
}, [filteredByDate, atribuicaoFilter, vendedorFilter]);
```

**5. Adicionar campos de filtro na UI:**
```typescript
{/* Filtro por Atribuição */}
<Select value={atribuicaoFilter} onValueChange={(v) => setAtribuicaoFilter(v as any)}>
  <SelectTrigger className="w-full md:w-[180px]">
    <SelectValue placeholder="Atribuição" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos</SelectItem>
    <SelectItem value="atribuido">Atribuídos</SelectItem>
    <SelectItem value="nao_atribuido">Não Atribuídos</SelectItem>
  </SelectContent>
</Select>

{/* Filtro por Vendedor */}
<Select value={vendedorFilter} onValueChange={setVendedorFilter}>
  <SelectTrigger className="w-full md:w-[200px]">
    <SelectValue placeholder="Vendedor" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Todos Vendedores</SelectItem>
    {vendedores.map((v) => (
      <SelectItem key={v.id} value={v.id}>
        {v.nome}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Alterações em PedidoOnlineDetailDialog.tsx

**1. Envolver o conteúdo em ScrollArea:**
```typescript
// Antes da linha 527 (início do conteúdo)
<ScrollArea className="max-h-[60vh] overflow-y-auto pr-4">
  <div className="space-y-4">
    {/* ... todo o conteúdo existente ... */}
  </div>
</ScrollArea>
```

**2. O import do ScrollArea já existe na linha 26.**

### Resultado Esperado

Após a implementação:
- Quando um vendedor é atribuído, o pedido permanece visível (se filtro "Todos" estiver selecionado)
- O usuário pode filtrar por pedidos atribuídos ou não atribuídos
- O usuário pode filtrar por vendedor específico
- O modal terá barra de rolagem quando o conteúdo exceder 60% da altura da tela
- O filtro padrão será "Não Atribuídos" para manter o comportamento esperado
