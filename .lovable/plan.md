

## Plano: Adicionar Editar e Excluir em Sessões de Sorteio

### Alterações em `src/pages/admin/SorteioAdmin.tsx` — componente `SessoesTab`

**1. Mutation de exclusão**
- Nova `deleteMutation` que executa `supabase.from("sorteio_sessoes").delete().eq("id", id)`
- Só permite excluir sessões inativas (`ativo === false`)
- Invalida query `admin-sorteio-sessoes` no sucesso

**2. Mutation de edição**
- Nova `updateMutation` que executa `supabase.from("sorteio_sessoes").update({...}).eq("id", id)`
- Atualiza nome, data_inicio, data_fim, intervalo_minutos, premio_padrao

**3. Estado de edição**
- State `editSession` para armazenar a sessão sendo editada (ou `null`)
- Reutilizar o mesmo Dialog de criação, adaptado para modo edição (título "Editar Sessão", botão "Salvar Alterações")

**4. UI nos cards de sessão**
- Adicionar dois botões ao lado do Ativar/Desativar:
  - **Editar** (ícone Pencil) — abre modal preenchido com dados da sessão
  - **Excluir** (ícone Trash2, vermelho) — com confirmação via `window.confirm()`, desabilitado se sessão ativa
- Layout: linha de 3 botões (Editar | Excluir | Ativar/Desativar)

### Resultado
- Admin pode editar nome, datas, intervalo e prêmio de qualquer sessão
- Admin pode excluir sessões inativas (com confirmação)
- Sessões ativas não podem ser excluídas (botão desabilitado)

