

## Plano: Adicionar exclusão de campanhas WhatsApp

### Alteração no arquivo `src/components/admin/WhatsAppCampaigns.tsx`

1. **Adicionar mutation de delete** — criar `deleteCampaignMutation` que deleta primeiro os destinatários (`whatsapp_campanha_destinatarios`) e depois a campanha (`whatsapp_campanhas`).

2. **Adicionar botão de excluir** na listagem de campanhas (step "list"), ao lado de cada card. Apenas campanhas com status `rascunho` podem ser excluídas. O botão terá ícone de lixeira e pedirá confirmação antes de excluir.

3. **Importar ícone `Trash2`** do lucide-react (já importado no projeto).

### Detalhes técnicos

- A exclusão cascateia: primeiro `DELETE FROM whatsapp_campanha_destinatarios WHERE campanha_id = X`, depois `DELETE FROM whatsapp_campanhas WHERE id = X`.
- Confirmação via `confirm()` nativo.
- Após sucesso, invalidar query `whatsapp-campanhas`.
- O botão de excluir fica no canto direito do card, com `e.stopPropagation()` para não abrir o funil ao clicar.

