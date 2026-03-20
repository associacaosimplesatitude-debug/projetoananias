

## Plano: Preservar participantes ao excluir sessão

### Problema
A função `deleteMutation` no `SorteioAdmin.tsx` (linha 93) deleta explicitamente todos os participantes da sessão antes de excluir a sessão. Além disso, a FK `sessao_id` em `sorteio_participantes` referencia `sorteio_sessoes(id)` sem `ON DELETE CASCADE`, mas o código faz o delete manual.

### Solução
1. **`src/pages/admin/SorteioAdmin.tsx`** (linhas 89-97): Alterar o `deleteMutation` para:
   - **Não deletar participantes** — remover a linha 93-94
   - Antes de deletar a sessão, fazer `UPDATE sorteio_participantes SET sessao_id = NULL WHERE sessao_id = id` para desvincular os participantes (evitar erro de FK)
   - Manter a exclusão de `sorteio_ganhadores` (linha 91) pois são dados do sorteio em si

2. **Migration SQL**: Alterar a FK de `sorteio_participantes.sessao_id` para `ON DELETE SET NULL` (para que futuras exclusões diretas também preservem os dados):
   ```sql
   ALTER TABLE sorteio_participantes 
     DROP CONSTRAINT sorteio_participantes_sessao_id_fkey,
     ADD CONSTRAINT sorteio_participantes_sessao_id_fkey 
       FOREIGN KEY (sessao_id) REFERENCES sorteio_sessoes(id) ON DELETE SET NULL;
   ```

### Resultado
Os participantes ficam armazenados permanentemente para futuros contatos, mesmo após excluir uma sessão. O `sessao_id` deles fica `NULL` indicando que a sessão foi removida.

