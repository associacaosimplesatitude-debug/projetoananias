## Objetivo

No portal `/multi-licenca` (mobile), os 4 cards de KPI ("Total de licenças", "Distribuídas", "Disponíveis", "Ativados") aparecem hoje empilhados (1 por linha), ocupando muita altura. Vamos passar a exibir **2 por linha** no mobile, mantendo 2 colunas em `sm` e 4 em `lg`.

## Mudança

Arquivo: `src/pages/superintendente/SuperintendenteHome.tsx`

Linhas 242 e 256, alterar a classe do wrapper dos KPIs:

- De: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`
- Para: `grid grid-cols-2 lg:grid-cols-4 gap-3`

Isso aplica 2 colunas a partir do menor breakpoint (mobile) e mantém 4 colunas em telas grandes. Sem alterar o conteúdo dos cards nem o restante da página.

## Ajuste defensivo no card

Para garantir que o conteúdo do card (ícone + label + número grande) não estoure em larguras estreitas (~180px no viewport 390), confirmar que o componente do KPI usa `min-w-0` e `truncate` no label. Se necessário, reduzir levemente o padding interno em mobile (ex: `p-3 sm:p-4`) e o tamanho do número (`text-2xl sm:text-3xl`) para manter a leitura confortável em duas colunas.

## Restrições

- Não mexer em outras seções (filtros, grid de pacotes, drawer).
- Não mexer no schema, hooks ou queries.
- Não mexer no layout desktop (continua 4 colunas em `lg`).
