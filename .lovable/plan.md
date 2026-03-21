
Problema identificado: o botão mostra sucesso, mas a embaixadora continua na lista porque a exclusão no frontend está muito provavelmente falhando de forma parcial/silenciosa por causa das regras atuais do banco.

O que confirmei
- A tela `/admin/ebd/sorteio` já tem o botão de excluir e o `deletarEmbMutation`.
- A mutation tenta apagar nesta ordem:
  1. `embaixadoras_vendas`
  2. `embaixadoras_cliques`
  3. `embaixadoras`
- A embaixadora que você tentou excluir ainda existe no banco (`Elba alencar`).
- Ela ainda tem registros associados:
  - 4 cliques
  - 0 vendas
- As FKs de `embaixadoras_cliques` e `embaixadoras_vendas` para `embaixadoras` estão sem cascata automática (`ON DELETE NO ACTION`).
- As policies atuais estão inconsistentes:
  - `embaixadoras_vendas` tem policy de `ALL`
  - `embaixadoras` tem `UPDATE`, mas não apareceu policy explícita de `DELETE`
  - `embaixadoras_cliques` também não mostrou policy explícita de `DELETE`

Ou seja: o toast de sucesso apareceu, mas o estado real indica que a deleção não foi concluída no banco. O ponto mais provável é bloqueio por RLS/DELETE policy, especialmente em `embaixadoras_cliques` e/ou `embaixadoras`.

Plano de correção
1. Revisar a mutation em `src/pages/admin/SorteioAdmin.tsx`
   - Garantir que ela valide o resultado de cada `delete`
   - Adicionar logs/checagens explícitas para não exibir sucesso se algum passo falhar
   - Forçar refetch da lista após sucesso real

2. Corrigir o backend para exclusão confiável
   - Criar ajuste de banco para que os relacionamentos usem exclusão em cascata:
     - `embaixadoras_cliques.embaixadora_id -> embaixadoras(id) ON DELETE CASCADE`
     - `embaixadoras_vendas.embaixadora_id -> embaixadoras(id) ON DELETE CASCADE`
   - Assim, ao apagar a embaixadora, os cliques e comissões/vendas somem automaticamente

3. Corrigir RLS/policies de DELETE
   - Garantir permissão segura de exclusão apenas para usuários autenticados com papel administrativo
   - Aplicar policy explícita de `DELETE` para:
     - `embaixadoras`
     - `embaixadoras_cliques`
     - `embaixadoras_vendas`
   - Isso evita sucesso “falso” no frontend quando o banco bloqueia a operação

4. Simplificar a lógica do frontend
   - Depois da cascata no banco, reduzir a exclusão para um único delete em `embaixadoras`
   - Manter confirmação via `AlertDialog`
   - Invalidar/refetch das queries:
     - `admin-embaixadoras`
     - `admin-emb-total-cliques`
     - `admin-emb-vendas-agg`
     - `admin-emb-comissoes-pendentes`

5. Validação esperada após implementação
   - Excluir uma embaixadora remove a linha da tabela imediatamente
   - Cliques e vendas/comissões vinculados somem junto
   - A embaixadora não reaparece ao recarregar a página
   - Nenhum toast de sucesso será mostrado se o banco rejeitar a exclusão

Detalhe técnico
- Hoje o sistema depende de 3 deletes no cliente, mas as constraints do banco não estão configuradas para cascata.
- Como há RLS habilitado nessas tabelas, basta faltar uma policy de `DELETE` para um dos passos quebrar a operação.
- A solução mais robusta é mover a responsabilidade principal para o banco com `ON DELETE CASCADE` e deixar o frontend fazer apenas o delete da embaixadora.
