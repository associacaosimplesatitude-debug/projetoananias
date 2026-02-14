
# Corrigir Posicionamento do Modal de Faturamento

## Problema
O modal continua aparecendo na parte inferior da tela, cortado. O `AlertDialogContent` base usa `top-[50%] translate-y-[-50%]` para centralizar, mas algo esta interferindo no posicionamento.

## Solucao
Forcar a centralizacao do modal adicionando classes explicitas de posicionamento e garantir que ele caiba na viewport.

### Arquivo: `src/components/vendedor/FaturamentoModeDialog.tsx`
- Na linha 29, substituir as classes do `AlertDialogContent` para incluir posicionamento explicito:
  - Adicionar `top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 fixed` para garantir centralizacao
  - Manter `max-h-[85vh] overflow-y-auto` para scroll quando necessario
  - Isso sobrescreve qualquer estilo herdado que esteja empurrando o modal para baixo
