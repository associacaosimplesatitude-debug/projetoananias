

# Melhorias no Painel Google Ads

## Problemas identificados

1. **Metricas nao aparecem automaticamente** - Os dados so carregam ao clicar em "Buscar Metricas" ou "Atualizar Tudo". Falta um `useEffect` para carregar automaticamente ao abrir a pagina.

2. **Visual dos cards nao corresponde ao Google Ads** - Atualmente os cards usam apenas uma borda lateral colorida. O screenshot de referencia mostra cards com **fundo colorido solido** (azul para Valor conv., vermelho para Cliques, cinza claro para CPC med. e Custo).

## Alteracoes planejadas

### Arquivo: `src/pages/admin/GoogleAdsPanel.tsx`

1. **Adicionar carregamento automatico** - Incluir `useEffect` que chama `fetchAll()` ao montar o componente, para que metricas, saldo e invoices aparecam imediatamente.

2. **Redesign dos cards de metricas** no estilo Google Ads:
   - **Valor conv.** - Fundo azul (`bg-blue-600`), texto branco, valor grande
   - **Cliques** - Fundo vermelho (`bg-red-600`), texto branco, valor grande
   - **CPC med.** - Fundo cinza claro (`bg-gray-100`), texto escuro
   - **Custo** - Fundo cinza claro (`bg-gray-100`), texto escuro
   - Todos com layout: label pequeno no topo, valor grande embaixo (sem icones)
   - Formato compacto em linha (similar ao screenshot)

3. **Adicionar skeleton/loading** enquanto as metricas carregam na primeira vez, para o usuario ver que algo esta acontecendo.

4. **Remover condicional `{metrics && ...}`** dos cards - em vez de esconder completamente, mostrar cards com skeleton ou valores zerados enquanto carrega.

### Detalhes tecnicos

- Adicionar `import { useEffect } from "react"` junto ao `useState`
- Adicionar `import { Skeleton } from "@/components/ui/skeleton"`
- `useEffect(() => { fetchAll(); }, [])` no componente
- Trocar os 4 cards de metricas por divs com classes de fundo colorido solido
- Formatar valores grandes com abreviacao (ex: 121 mil, 41,8 mil, R$ 27,5 mil)
