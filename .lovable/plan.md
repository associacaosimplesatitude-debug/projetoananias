
# Plano: Adicionar Botão "Pagar" nas Comissões Pendentes

## Contexto
Na página de Gestão de Comissões (`/admin/ebd/comissoes`), na aba **Pendentes**, o administrador visualiza as comissões com status `agendada` e `pendente`, mas atualmente **não há ação disponível** para marcá-las como pagas diretamente.

O usuário solicita:
1. Adicionar botão ou checkbox para marcar comissões pendentes como "Paga"
2. Quando marcada como paga, a comissão deve aparecer para o vendedor
3. Deve também aparecer na seção de agendadas

---

## Arquitetura Atual

```text
+------------------------+       +------------------------+
|  GestaoComissoes.tsx   |       |   ComissaoTable.tsx    |
|------------------------|       |------------------------|
|  Aba Pendentes:        |  -->  |  showActions=false     |
|  - Agendadas           |       |  (sem botões)          |
|  - Pendentes           |       |                        |
+------------------------+       +------------------------+

Campos na tabela vendedor_propostas_parcelas:
- status: paga, aguardando, atrasada (pagamento do cliente)
- comissao_status: pendente, agendada, liberada, paga (pagamento ao vendedor)
```

---

## Mudanças Planejadas

### 1. Modificar `ComissaoTable.tsx`
**Arquivo:** `src/components/admin/comissoes/ComissaoTable.tsx`

Atualmente o botão "Pagar" só aparece para status `liberada`. Vamos modificar para:
- Mostrar botão para `pendente`, `agendada` e `liberada`
- Para `pendente`/`agendada`: botão com ícone de check e texto "Marcar Paga"
- Para `liberada`: mantém comportamento atual

```text
Antes:
  if (item.comissao_status === "liberada" && showActions) → Botão "Pagar"

Depois:
  if (showActions && status em ["pendente", "agendada", "liberada"]) → Botão "Marcar Paga"
```

### 2. Modificar `GestaoComissoes.tsx` - Aba Pendentes
**Arquivo:** `src/pages/admin/GestaoComissoes.tsx`

Mudar de `showActions={false}` para `showActions={true}` na aba Pendentes:

```tsx
// Linha ~1429
<ComissaoTable
  comissoes={[
    ...comissoesFiltradas.filter(c => c.comissao_status === 'agendada'),
    ...comissoesFiltradas.filter(c => c.comissao_status === 'pendente')
  ]}
  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
  showActions={true}  // ← Alterar de false para true
  isAdmin={isAdmin}
/>
```

### 3. Atualizar a Mutation para Suportar Pendentes
**Arquivo:** `src/pages/admin/GestaoComissoes.tsx`

A mutation `marcarPagaMutation` já atualiza para `comissao_status: 'paga'`, então funciona para todos os status. Nenhuma alteração necessária na lógica.

---

## Fluxo Atualizado

```text
╔══════════════════════════════════════════════════════════════╗
║  ADMIN: Aba Pendentes                                        ║
╠══════════════════════════════════════════════════════════════╣
║  [Agendadas] [Pendentes 30/60/90]                            ║
║                                                              ║
║  Vendedor    Cliente        Status      Ação                 ║
║  ─────────────────────────────────────────────────────────── ║
║  Elaine      ADVEC CASTELO  ⏳Pendente   [✓ Marcar Paga]     ║
║  Daniel      IGREJA REAVI   ⏳Pendente   [✓ Marcar Paga]     ║
║  Neila       TENDA LIVRARIA 📅Agendada   [✓ Marcar Paga]     ║
╚══════════════════════════════════════════════════════════════╝
                         │
                         ▼ (Clica em Marcar Paga)
╔══════════════════════════════════════════════════════════════╗
║  - comissao_status atualizado para 'paga'                    ║
║  - comissao_paga_em = timestamp atual                        ║
║  - Comissão aparece na Aba "Pagas"                           ║
║  - Vendedor vê comissão como "Paga" na tela dele             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Detalhes Técnicos

### Alteração 1: ComissaoTable.tsx
```tsx
// Linha 291-304 - Expandir condição do botão
{showActions && (
  <TableCell>
    <div className="flex items-center gap-1">
      {/* Permitir marcar como paga para: liberada, pendente, agendada */}
      {["liberada", "pendente", "agendada"].includes(item.comissao_status) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onMarcarPaga(item.id)}
          disabled={isUpdating}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Pagar
        </Button>
      )}
      {/* ... resto do código (botão excluir) */}
    </div>
  </TableCell>
)}
```

### Alteração 2: GestaoComissoes.tsx - Aba Pendentes
```tsx
// Linha 1428-1441
<ComissaoTable
  comissoes={[
    ...comissoesFiltradas.filter(c => c.comissao_status === 'agendada'),
    ...comissoesFiltradas.filter(c => c.comissao_status === 'pendente')
  ]}
  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
  onBuscarNfe={handleBuscarNfe}
  onRefazerNfe={handleRefazerNfe}
  isUpdating={marcarPagaMutation.isPending}
  showActions={true}
  isAdmin={isAdmin}
/>
```

---

## Impacto na Tela do Vendedor

A tela do vendedor (`VendedorParcelas.tsx`) lê o campo `status` da parcela (não `comissao_status`). Porém, quando o admin marca a comissão como paga:
- O campo `comissao_status` muda para `'paga'`
- O campo `comissao_paga_em` recebe a data/hora atual

Para que o vendedor veja a comissão como "paga" corretamente, a tela dele já deveria estar usando `comissao_status`. Vou verificar e, se necessário, ajustar para exibir corretamente.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `ComissaoTable.tsx` | Expandir condição do botão "Pagar" para incluir `pendente` e `agendada` |
| `GestaoComissoes.tsx` | Mudar `showActions={false}` para `showActions={true}` na aba Pendentes |

---

## Resultado Esperado

1. Na aba **Pendentes**, cada linha terá um botão **"Pagar"** ou **checkmark**
2. Ao clicar, a comissão é marcada como `paga` imediatamente
3. A comissão sai da lista de Pendentes e aparece na aba **Pagas**
4. O vendedor visualiza a comissão como paga na tela dele
5. O total de "Pagas este mês" é atualizado automaticamente
