
# Plano: Adicionar opção de deletar Quiz

## Resumo
Adicionar um botão de exclusão em cada card de quiz na página `/ebd/quizzes`, com diálogo de confirmação para evitar exclusões acidentais.

## Análise Técnica

### Estrutura do Banco de Dados
- **Tabela principal**: `ebd_quizzes`
- **Tabelas relacionadas**: `ebd_quiz_questoes` e `ebd_quiz_respostas`
- **Cascade Delete**: Ambas as tabelas relacionadas têm `ON DELETE CASCADE`, então ao deletar um quiz, as questões e respostas serão automaticamente removidas

### RLS Policies (já configuradas)
O superintendente já tem permissão para deletar quizzes através da policy:
```sql
"Superintendentes can manage quizzes" - is_ebd_superintendente_for_church(auth.uid(), church_id)
```

## Modificações

### Arquivo: `src/pages/ebd/Quizzes.tsx`

1. **Adicionar imports necessários**:
   - `useMutation` e `useQueryClient` do TanStack Query
   - `Trash2` e `MoreVertical` do Lucide
   - Componentes do AlertDialog e DropdownMenu
   - `toast` do Sonner

2. **Adicionar estados**:
   - `quizToDelete`: Quiz selecionado para exclusão
   - `deleteDialogOpen`: Controle do diálogo de confirmação

3. **Criar mutation de exclusão**:
   ```typescript
   const deleteQuizMutation = useMutation({
     mutationFn: async (quizId: string) => {
       const { error } = await supabase
         .from("ebd_quizzes")
         .delete()
         .eq("id", quizId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["quizzes-superintendente"] });
       toast.success("Quiz excluído com sucesso!");
       setDeleteDialogOpen(false);
       setQuizToDelete(null);
     },
     onError: (error) => {
       toast.error("Erro ao excluir quiz: " + error.message);
     },
   });
   ```

4. **Adicionar menu de ações no card**:
   - Botão com ícone `MoreVertical` no canto superior direito do CardHeader
   - DropdownMenu com opção "Excluir" em vermelho

5. **Adicionar AlertDialog de confirmação**:
   - Título: "Excluir Quiz"
   - Mensagem informando que as respostas dos alunos também serão removidas
   - Botões: "Cancelar" e "Excluir"

## Layout Visual

```text
+------------------------------------------+
| O Clamor de um Povo Exilado    [⋮]       |  <- Menu dropdown
| Adultos • 29/01                          |
+------------------------------------------+
| 👥 0 responderam                         |
+------------------------------------------+

Dropdown Menu:
+------------------+
| 🗑️ Excluir       |  <- Texto em vermelho
+------------------+

AlertDialog:
+------------------------------------------+
|          Excluir Quiz                    |
|                                          |
| Tem certeza que deseja excluir o quiz    |
| "O Clamor de um Povo Exilado"?           |
|                                          |
| Esta ação também removerá todas as       |
| respostas dos alunos.                    |
|                                          |
|        [Cancelar]    [Excluir]           |
+------------------------------------------+
```

## Padrão Seguido
Este plano segue exatamente o padrão já implementado em:
- `src/pages/ebd/Classrooms.tsx` (exclusão de turmas)
- `src/pages/ebd/Students.tsx` (exclusão de alunos)
- `src/pages/ebd/Teachers.tsx` (exclusão de professores)
