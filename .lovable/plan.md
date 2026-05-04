# Aba "Lidas" no modal de Implementações

## Problema
Hoje o modal tem apenas dois filtros: **Todas** / **Não lidas**. Quando o usuário marca um item como lido, ele some da visualização "Não lidas" (default) e fica difícil reencontrá-lo.

## Solução
Transformar o filtro atual em **três opções**, sem mexer no layout geral:

```
[ Não lidas ]  [ Lidas ]  [ Todas ]
```

- **Não lidas** (default): só itens com `lida = false`
- **Lidas**: só itens com `lida = true` — para consultar histórico
- **Todas**: tudo

A contagem `(N)` ao lado de cada label mostra quantos itens existem em cada filtro, dentro da aba ativa (Novas funções / Correções).

## Comportamento ao marcar como lido
- Mantém o comportamento atual: ao clicar num item ele é marcado como lido automaticamente.
- Se o usuário está em "Não lidas" e marca um item, ele desaparece da lista (vai para a aba "Lidas"). Isso é o esperado e o que o usuário quer.
- O item permanece selecionado no painel direito até o usuário trocar.

## Detalhes técnicos
- Arquivo: `src/components/implementacoes/ImplementacoesModal.tsx`
- Trocar o estado `filter: "todas" | "nao_lidas"` por `filter: "nao_lidas" | "lidas" | "todas"`.
- Atualizar `filteredList` para aplicar o terceiro caso.
- Substituir o segmented control de 2 botões por 3 botões com a mesma estética (rounded-full, mesma cor emerald do projeto).
- Mostrar contadores ao lado de cada label baseados em `novidades` filtradas pelo `tipo` da aba ativa.

Sem mudanças no banco, sem mudanças em hooks, sem mudanças em outras páginas.