
# Plano: Corrigir Fluxo de Pagamento de Comissões

## Problema

O botão "Pagar" na aba **Pendentes Futuras** está com a ação errada:
- **Atual**: Clica "Pagar" → muda para `paga` → vai para aba "Pagas"
- **Esperado**: Clica "Liberar" → muda para `liberada` → vai para aba "A Pagar"

## Fluxo Correto

```text
╔═══════════════════════════════════════════════════════════════════════════╗
║                    FLUXO CORRETO DE COMISSÕES                             ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                           ║
║  1. PENDENTE/AGENDADA                                                     ║
║     └─ Aba: "Pendentes Futuras"                                           ║
║     └─ Significado: Cliente AINDA NÃO PAGOU a fatura                      ║
║     └─ Ação: [✓ Liberar] → Confirma que cliente pagou                     ║
║                    │                                                      ║
║                    ▼                                                      ║
║  2. LIBERADA                                                              ║
║     └─ Aba: "A Pagar"                                                     ║
║     └─ Significado: Cliente pagou, comissão LIBERADA para vendedor        ║
║     └─ Ação: [💰 Pagar] → Confirma pagamento ao vendedor                  ║
║                    │                                                      ║
║                    ▼                                                      ║
║  3. PAGA                                                                  ║
║     └─ Aba: "Pagas"                                                       ║
║     └─ Significado: Empresa PAGOU comissão ao vendedor                    ║
║     └─ Visível para vendedor como "Comissão Recebida"                     ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Mudanças Planejadas

### 1. Criar Nova Mutation para Liberar Comissão
**Arquivo:** `src/pages/admin/GestaoComissoes.tsx`

Adicionar uma nova mutation `liberarComissaoMutation` que muda o status de `pendente`/`agendada` para `liberada`:

```tsx
const liberarComissaoMutation = useMutation({
  mutationFn: async (id: string) => {
    const { error } = await supabase
      .from("vendedor_propostas_parcelas")
      .update({ 
        comissao_status: 'liberada',
        data_liberacao: new Date().toISOString().split('T')[0]
      })
      .eq("id", id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["admin-comissoes-parcelas"] });
    toast.success("Comissão liberada! Aparece agora em 'A Pagar'");
  },
  onError: (error) => {
    toast.error("Erro ao liberar comissão");
  },
});
```

### 2. Modificar ComissaoTable Props
**Arquivo:** `src/components/admin/comissoes/ComissaoTable.tsx`

Adicionar nova prop `onLiberar` e modificar a lógica do botão:
- Para status `pendente` ou `agendada`: mostrar botão "Liberar" (ícone check)
- Para status `liberada`: mostrar botão "Pagar" (ícone dinheiro)

| Status | Botão | Ação | Resultado |
|--------|-------|------|-----------|
| `pendente` | ✓ Liberar | `onLiberar()` | → `liberada` |
| `agendada` | ✓ Liberar | `onLiberar()` | → `liberada` |
| `liberada` | 💰 Pagar | `onMarcarPaga()` | → `paga` |

### 3. Atualizar Aba Pendentes
**Arquivo:** `src/pages/admin/GestaoComissoes.tsx`

Na aba "Pendentes Futuras", passar a nova função `onLiberar` ao invés de `onMarcarPaga`:

```tsx
<ComissaoTable
  comissoes={[
    ...comissoesFiltradas.filter(c => c.comissao_status === 'agendada'),
    ...comissoesFiltradas.filter(c => c.comissao_status === 'pendente')
  ]}
  onLiberar={(id) => liberarComissaoMutation.mutate(id)}
  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
  // ...
/>
```

---

## Detalhes Técnicos

### Alteração 1: ComissaoTable.tsx - Interface

```tsx
interface ComissaoTableProps {
  comissoes: ComissaoItem[];
  onMarcarPaga: (id: string) => void;
  onLiberar?: (id: string) => void;  // NOVO
  // ... resto das props
}
```

### Alteração 2: ComissaoTable.tsx - Botões

```tsx
{showActions && (
  <TableCell>
    <div className="flex items-center gap-1">
      {/* Botão LIBERAR para pendente/agendada */}
      {["pendente", "agendada"].includes(item.comissao_status) && onLiberar && (
        <Button
          size="sm"
          variant="outline"
          className="text-blue-600 border-blue-300 hover:bg-blue-50"
          onClick={() => onLiberar(item.id)}
          disabled={isUpdating}
        >
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Liberar
        </Button>
      )}
      
      {/* Botão PAGAR apenas para liberada */}
      {item.comissao_status === "liberada" && (
        <Button
          size="sm"
          variant="outline"
          className="text-green-600 border-green-300 hover:bg-green-50"
          onClick={() => onMarcarPaga(item.id)}
          disabled={isUpdating}
        >
          <DollarSign className="h-3 w-3 mr-1" />
          Pagar
        </Button>
      )}
      
      {/* ... resto (botão excluir) */}
    </div>
  </TableCell>
)}
```

### Alteração 3: GestaoComissoes.tsx - Nova Mutation

Adicionar `liberarComissaoMutation` após `marcarPagaMutation` (linha ~638).

### Alteração 4: GestaoComissoes.tsx - Aba Pendentes

Modificar linhas ~1429-1440 para usar `onLiberar`:

```tsx
<ComissaoTable
  comissoes={[
    ...comissoesFiltradas.filter(c => c.comissao_status === 'agendada'),
    ...comissoesFiltradas.filter(c => c.comissao_status === 'pendente')
  ]}
  onLiberar={(id) => liberarComissaoMutation.mutate(id)}
  onMarcarPaga={(id) => marcarPagaMutation.mutate(id)}
  isUpdating={liberarComissaoMutation.isPending || marcarPagaMutation.isPending}
  showActions={true}
  isAdmin={isAdmin}
/>
```

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `ComissaoTable.tsx` | Adicionar prop `onLiberar` e lógica de botões separados |
| `GestaoComissoes.tsx` | Criar `liberarComissaoMutation` |
| `GestaoComissoes.tsx` | Aba Pendentes: usar `onLiberar` ao invés de `onMarcarPaga` |

---

## Resultado Esperado

1. Na aba **Pendentes Futuras**: botão "Liberar" → comissão vai para "A Pagar"
2. Na aba **A Pagar**: botão "Pagar" → comissão vai para "Pagas"
3. Vendedor vê corretamente: "Liberada" em A Pagar, "Paga" em Recebidas
