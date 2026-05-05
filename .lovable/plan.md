## Diagnóstico

A aba **E-commerce** em `src/components/admin/AdminPedidosTab.tsx`:

- busca os pedidos em `useQuery(["admin-all-shopify-pedidos"])` nas linhas **213-289**
- aplica o filtro de período **no cliente**, em `matchesFilters(...)` nas linhas **598-625**
- monta `filteredShopifyPedidos` nas linhas **629-643**

### Causa raiz confirmada
As 3 consultas da `queryFn` fazem apenas:

- `from("ebd_shopify_pedidos").select(...).order("created_at", { ascending: false })`
- `from("ebd_shopify_pedidos_cg").select(...).order("created_at", { ascending: false })`
- `from("ebd_loja_pedidos_cg").select(...).order("created_at", { ascending: false })`

Sem `.range(...)`, a API retorna só o recorte padrão de até **1000 registros por tabela**.

Como o filtro de março é aplicado **depois**, no frontend, os pedidos antigos nem chegam ao navegador.

### Evidência do backend
Contagem real em **março/2026**:

- `ebd_shopify_pedidos`: **450** registros no mês
- `ebd_shopify_pedidos_cg`: **196** registros no mês
- `ebd_loja_pedidos_cg`: **0** registros no mês

Com a regra atual da aba E-commerce, ainda há exclusão de `order_number like 'BLING-%'`, então o volume visível esperado para março fica em aproximadamente:

- `ebd_shopify_pedidos`: **254** visíveis na aba
- `ebd_shopify_pedidos_cg`: **196** visíveis na aba
- `ebd_loja_pedidos_cg`: **0** em março
- **Total esperado em março na aba E-commerce: ~450**

### Prova de que o recorte atual corta março
Nos **1000 mais recentes** de cada fonte hoje:

- `ebd_shopify_pedidos`: o mais antigo carregado é **2026-04-05**
- `ebd_shopify_pedidos_cg`: o mais antigo carregado é **2026-04-05**
- `ebd_loja_pedidos_cg`: só tem dados a partir de **2026-04-24**

Resultado: ao filtrar **01/03/2026 até 31/03/2026**, a aba fica zerada porque março não está dentro do lote carregado.

## Correção mínima proposta
Alterar **somente** `src/components/admin/AdminPedidosTab.tsx`, dentro da `queryFn` de `admin-all-shopify-pedidos`, para:

1. Criar um helper local de paginação com `.range(offset, offset + 999)`
2. Buscar **todas** as páginas de:
   - `ebd_shopify_pedidos`
   - `ebd_shopify_pedidos_cg`
   - `ebd_loja_pedidos_cg`
3. Manter o merge atual das 3 fontes
4. Manter o sort final por `created_at desc`
5. Não mexer em abas, UI, filtros visuais, tabelas ou backend

## Escopo exato
Somente este arquivo:

- `src/components/admin/AdminPedidosTab.tsx`

Sem migration. Sem mudança de UI. Sem refatoração de componente. Sem tocar Mercado Pago / Balcão / B2B.

## Validação após aplicar
Depois da correção, com filtro personalizado **01/03/2026 → 31/03/2026**, a aba **E-commerce** deve deixar de mostrar `0` e passar a mostrar aproximadamente **450 pedidos** com a lógica atual.

## Detalhes técnicos
- O problema não é ausência de dados históricos no banco.
- O problema não é a aba em si.
- O problema é o padrão de paginação implícita da consulta, combinado com filtro de data feito no frontend.
- A menor correção segura é paginar a carga das 3 tabelas dentro da própria `queryFn`.

Se você aprovar, eu aplico exatamente essa correção mínima.