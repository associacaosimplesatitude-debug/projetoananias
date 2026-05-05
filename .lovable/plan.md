## Mostrar "dias até fechar" no card Fechados

No Kanban da Retenção, na coluna **Fechados (mês)**, exibir quantos dias o cliente demorou para voltar a comprar (gap entre a compra anterior e a compra do mês atual).

### Alterações

**1. RPC `get_retencao_dashboard` (migration)**
- No CTE `com_dias`, calcular para cada cliente fechado o `dias_para_fechar`:
  - Se `marcado_comprou_mes` (registro manual em `ebd_retencao_contatos` com resultado `comprou`): usar `data_contato` desse registro menos `dt_compra_anterior`.
  - Caso contrário: `dt_mes_compra` (a compra mais recente do mês, vinda do MAX entre `s.dt_mes`, `m.dt_mes`, `f.dt_mes`) menos `dt_compra_anterior`.
- Adicionar campo `dias_para_fechar` (int, nullable) ao JSON `kanban_clientes`.

**2. `RetencaoKanban.tsx`**
- Adicionar `dias_para_fechar?: number | null` à interface `KanbanCliente`.
- Na coluna `fechados`, substituir/complementar o badge de "Xd sem compra" por um badge verde **"Fechou em Yd"** quando o campo existir.
- Manter o resto do card idêntico (canal, vendedor, ticket médio, ações).

### Fora de escopo
- Não alterar cards do dashboard, filtros, modal de registro, nem outras colunas do Kanban.