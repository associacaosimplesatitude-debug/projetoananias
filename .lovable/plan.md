

## Plano: Botão de excluir embaixadora com cascata de dados

### O que será feito
Adicionar um botão de exclusão na tabela de embaixadoras (aba Embaixadoras do `/admin/ebd/sorteio`). Ao excluir, também serão removidos:
- Registros de cliques (`embaixadoras_cliques`)
- Registros de vendas/comissões (`embaixadoras_vendas`)
- A embaixadora em si (`embaixadoras`)

### Alterações

**Arquivo: `src/pages/admin/SorteioAdmin.tsx`**

1. Criar `deletarEmbMutation` dentro de `EmbaixadorasTab()` que executa em sequência:
   - `DELETE FROM embaixadoras_vendas WHERE embaixadora_id = id`
   - `DELETE FROM embaixadoras_cliques WHERE embaixadora_id = id`
   - `DELETE FROM embaixadoras WHERE id = id`
   - Invalida queries e exibe toast de sucesso

2. Na tabela de embaixadoras (linha ~1246), adicionar botão com ícone `Trash2` ao lado do botão de visualizar (Eye), envolvido em `AlertDialog` para confirmação antes de excluir.

### Segurança
- Confirmação obrigatória via AlertDialog antes da exclusão
- Exclusão cascata feita no frontend (3 deletes sequenciais) para garantir que todos os dados relacionados sejam removidos

