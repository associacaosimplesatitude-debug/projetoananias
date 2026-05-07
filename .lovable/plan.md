## Mostrar somatório no topo de todas as colunas do Kanban

No `RetencaoKanban.tsx`, hoje a linha "Total: R$ X" aparece apenas em **A Contatar** e **Fechados (mês)** (controlada pela flag `showTotal`).

### Mudança
- Remover a flag `showTotal` e exibir o total em **todas as 5 colunas**: A Contatar, Interessado, Falar com Consultor, Recusou e Fechados (mês).
- Manter o mesmo formato visual (`Total: R$ X`, fonte pequena, abaixo do título da coluna).
- Cálculo continua somando `valor_total_compras` de cada card visível (respeitando filtros de vendedor/canal).

### Arquivo afetado
- `src/components/admin/retencao/RetencaoKanban.tsx`