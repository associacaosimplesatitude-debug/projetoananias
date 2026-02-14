
# Corrigir Modal Cortado no Rodape

## Problema
O modal esta posicionado parcialmente fora da area visivel, com os botoes de opcao cortados na parte inferior da tela.

## Solucao
Adicionar restricao de altura maxima e scroll automatico ao `AlertDialogContent` para garantir que o modal sempre caiba na tela.

### Arquivo: `src/components/vendedor/FaturamentoModeDialog.tsx`
- Linha 29: adicionar `max-h-[85vh] overflow-y-auto` na classe do `AlertDialogContent`
- Isso garante que o modal nunca ultrapasse 85% da altura da tela e, caso o conteudo seja maior, permite rolagem interna
