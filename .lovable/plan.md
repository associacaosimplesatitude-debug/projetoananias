
# Funil de Vendas: Visao Admin vs Vendedor

## Problema Atual
O componente `VendedorFunil.tsx` filtra por `vendedor?.id` em todas as queries, mas so funciona na area do vendedor. O admin precisa ver TODOS os clientes (sem filtro de vendedor), e o vendedor so os que foram atribuidos a ele.

## Solucao

### 1. Tornar o componente reutilizavel com uma prop `isAdmin`

Adicionar uma prop opcional `isAdminView` ao `VendedorFunil`. Quando `true`, nao aplica o filtro `vendedor_id` nas queries (mostra todos). Quando `false` (padrao), filtra pelo vendedor logado.

### 2. Adicionar rota no painel Admin EBD

Rota: `/admin/ebd/funil`

Dentro do `AdminEBDLayout`, renderizar o mesmo componente `VendedorFunil` com `isAdminView={true}`.

### 3. Adicionar item no menu lateral do Admin EBD

Adicionar "Funil de Vendas" no sidebar do `AdminEBDLayout.tsx`.

## Arquivos a Editar

1. **`src/pages/vendedor/VendedorFunil.tsx`**
   - Aceitar prop `isAdminView?: boolean`
   - Quando `isAdminView = true`: nao filtrar por vendedor_id, usar `enabled: true` (sem depender de `vendedor`)
   - Quando `isAdminView = false`: manter logica atual (filtra por vendedor_id)
   - Ajustar subtitulo: "todos os clientes" vs "seus clientes"

2. **`src/App.tsx`**
   - Adicionar rota `/admin/ebd/funil` renderizando `<VendedorFunil isAdminView />`

3. **`src/components/admin/AdminEBDLayout.tsx`**
   - Adicionar item "Funil de Vendas" no menu lateral com icone Filter

## Detalhes Tecnicos

No `VendedorFunil.tsx`, a logica de filtro muda assim:

```text
// Antes (sempre filtra):
const vendedorFilter = vendedor?.id;
if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);

// Depois:
const vendedorFilter = isAdminView ? null : vendedor?.id;
if (vendedorFilter) q = q.eq("vendedor_id", vendedorFilter);
```

A query sera habilitada com `enabled: isAdminView || !!vendedor` para funcionar sem depender do hook `useVendedor` no modo admin.
