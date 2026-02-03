

# Plano: Reestruturar Menu do Admin EBD

## Resumo das Alterações

| Ação | Item Atual | Novo Estado |
|------|------------|-------------|
| Renomear | "Pedidos Igrejas" | "Atribuir Clientes" |
| Ocultar | "Clientes para Atribuir" | Removido do menu |

## Arquivo a Modificar

**`src/components/admin/AdminEBDLayout.tsx`**

### Alteração 1: Renomear "Pedidos Igrejas"

Na seção "Operacional" (linha 267-296), o item "Pedidos Igrejas" será renomeado para "Atribuir Clientes".

**Antes:**
```tsx
<span>Pedidos Igrejas</span>
```

**Depois:**
```tsx
<span>Atribuir Clientes</span>
```

### Alteração 2: Remover "Clientes para Atribuir"

O item de menu "Clientes para Atribuir" (linhas 278-292) será completamente removido da seção Operacional.

Isso significa que a seção "Operacional" ficará apenas com o item "Atribuir Clientes" (antigo "Pedidos Igrejas").

## Resultado Esperado

Menu "Operacional" antes:
- Pedidos Igrejas
- Clientes para Atribuir (com badge de contagem)

Menu "Operacional" depois:
- Atribuir Clientes

---

## Seção Técnica

### Linhas afetadas no arquivo `AdminEBDLayout.tsx`

| Linha | Ação |
|-------|------|
| 274 | Trocar texto "Pedidos Igrejas" por "Atribuir Clientes" |
| 278-292 | Remover bloco do SidebarMenuItem "Clientes para Atribuir" |

A query `countSemVendedor` (linhas 71-96) pode ser mantida caso seja utilizada em outro lugar, mas se não for mais necessária, também pode ser removida para otimização.

