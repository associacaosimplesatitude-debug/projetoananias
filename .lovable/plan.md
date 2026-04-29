# Remover a tag laranja "Lição N" do card de lição

## Problema

Em `/admin/ebd/revistas-digitais`, dentro do modal "Gerenciar Lições", cada card mostra:

- Um badge laranja com `Lição {licao.numero}` (a posição da lição na lista, 1..N)
- Um input com o título digitado pelo usuário (ex: "Lição 3")

Quando o usuário renomeia ou arrasta para reordenar, o número do badge laranja deixa de bater com o título digitado, causando confusão visual (ex: badge "Lição 8" em cima do título "Lição 3").

## Solução

Remover o badge laranja `<Badge>Lição {licao.numero}</Badge>` da linha 834 de `src/pages/admin/RevistasDigitais.tsx`.

O título digitado pelo usuário (input logo abaixo) passa a ser a única identificação visível do card. Os demais elementos do header continuam:

- Alça de arrastar (`GripVertical`)
- Badge de páginas ("N páginas" / "Sem páginas")
- Indicador "Reordenando..." quando aplicável

## Por que é seguro

- `licao.numero` continua existindo no banco e é usado internamente para:
  - Ordenação (`order("numero")`)
  - Recálculo de posição no drag-and-drop (`reorderLicoes`)
  - Geração do título padrão ao criar nova lição (`Lição ${newNumero}`)
  - Rótulo do editor de quiz (`Lição ${licao.numero} — ${licao.titulo}`)
  - Confirmação de remoção (`Tem certeza que deseja remover a Lição ${licao.numero}?`)
- Apenas o badge visual no card é removido; nenhuma lógica de banco, quiz, drag-and-drop ou ordenação é alterada.

## Arquivo alterado

- `src/pages/admin/RevistasDigitais.tsx` — remoção de 1 linha (834).
