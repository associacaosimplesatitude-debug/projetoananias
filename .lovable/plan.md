# Drag-and-drop dos cards de lição

Permitir arrastar cada card de lição para cima ou para baixo na tela `/admin/ebd/revistas-digitais` (modal "Gerenciar Lições"), persistindo a nova ordem no banco.

## Comportamento

- Cada card de lição ganha uma "alça" de arrastar (ícone `GripVertical`) no canto esquerdo do cabeçalho.
- O usuário arrasta o card e solta sobre outro card; a lista é reordenada localmente na hora.
- O campo `numero` de cada lição é recalculado (1..N) seguindo a nova ordem e persistido em batch no Supabase.
- Durante o salvamento, exibe um pequeno spinner ("Reordenando...") e bloqueia novos drags.
- Feedback visual: o card sendo arrastado fica com opacidade reduzida; o card-alvo recebe uma borda destacada indicando onde será inserido.
- Em caso de erro no banco, faz rollback (refetch da query) e mostra toast de erro.

## Implementação técnica

Arquivo único: `src/pages/admin/RevistasDigitais.tsx`.

1. **Estado novo** (próximo a `draggingPageIdx`):
   - `draggingLicaoId: string | null`
   - `dragOverLicaoId: string | null`
   - `reorderingLicoes: boolean`

2. **Função `reorderLicoes(fromId, toId)`**:
   - Clona `licoes`, remove o item arrastado e o reinsere na posição do alvo.
   - Atualiza `queryClient.setQueryData(["revista-licoes", managingLicoes.id], newList)` para reflexo imediato.
   - Faz `supabase.from("revista_licoes").upsert([...])` passando `id` + novo `numero` para cada lição (ou um loop de updates sequenciais — mais seguro contra conflitos da unique constraint, se houver). Para evitar colisão de unique em `(revista_id, numero)`, primeiro seta todos para números temporários negativos, depois aplica os definitivos.
   - `invalidateQueries` ao final.

3. **Handlers no `<Card>` da lição** (linha 751):
   - `draggable={!reorderingLicoes}`
   - `onDragStart`: define `draggingLicaoId = licao.id`, `e.dataTransfer.effectAllowed = "move"`.
   - `onDragOver`: `e.preventDefault()`, define `dragOverLicaoId = licao.id`.
   - `onDragLeave`: limpa `dragOverLicaoId` se for o atual.
   - `onDrop`: chama `reorderLicoes(draggingLicaoId, licao.id)`, limpa estados.
   - `onDragEnd`: limpa estados.
   - Classes condicionais: `opacity-50` se for o card arrastado; `ring-2 ring-primary` se for o alvo.

4. **Alça visual**: adicionar um `<GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />` no início do header do card, antes do badge "Lição N".

5. **Sem deps novas**: usa HTML5 Drag and Drop nativo (mesmo padrão já usado para reordenar páginas via `draggingPageIdx`).

## O que NÃO muda

- Edge functions, schema do banco, lógica de quiz/referências, upload de páginas, outras páginas admin.
- A coluna `numero` continua sendo o campo de ordenação (já é usado em `.order("numero")`).
