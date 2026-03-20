

## Plano: Botão "olhinho" para ver detalhes da embaixadora

### O que será feito

Adicionar um botão com ícone de olho (Eye) na coluna "Ação" de cada embaixadora na tabela do admin. Ao clicar, abre um Dialog/modal com os dados completos da embaixadora e seu link de compartilhamento, com botão de copiar.

### Alterações em `src/pages/admin/SorteioAdmin.tsx`

1. **Import**: Adicionar `Eye`, `Copy` aos imports do lucide-react
2. **Estado**: Adicionar `selectedEmb` state para controlar qual embaixadora está selecionada no modal
3. **Modal**: Adicionar um `Dialog` que exibe:
   - Nome, Email, WhatsApp, Código único
   - Status e Tier
   - Vendas e Comissão totais
   - Data de cadastro
   - Link completo (`https://gestaoebd.lovable.app/r/{codigo_unico}`) com botão de copiar
4. **Botão Eye**: Na coluna "Ação", ao lado do botão "Ativar" existente, adicionar botão com ícone `Eye` que seta `selectedEmb` e abre o modal

### Detalhes técnicos

- O link da embaixadora segue o padrão `/r/{codigo_unico}` conforme o `EmbaixadoraRedirect.tsx`
- Usar `navigator.clipboard.writeText()` + `toast.success` para feedback ao copiar
- Os dados já estão disponíveis no objeto `e` da iteração (nome, email, codigo_unico, status, total_vendas, total_comissao, embaixadoras_tiers, created_at)
- Verificar se `whatsapp` está no select da query de embaixadoras; se não, adicioná-lo

