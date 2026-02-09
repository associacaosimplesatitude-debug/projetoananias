

# Plano: Melhorar Layout Responsivo + Criar Escala Geral

## Parte 1: Corrigir Layout Responsivo dos Cards de Revistas

### Problema
No mobile, o card usa `flex items-center` em uma unica linha horizontal com imagem + grid + botoes, causando sobreposicao de texto e botoes (como na imagem enviada).

### Solucao
**Arquivo:** `src/pages/ebd/Schedule.tsx`

Mudar o layout dos cards de revistas ativas e finalizadas para empilhar verticalmente no mobile:

- **Mobile**: Layout vertical - imagem + info em cima, botoes embaixo
- **Desktop**: Manter layout horizontal atual

```text
MOBILE (atual - quebrado):
[img] [turma faixa dia progresso] [botao] [lixo]  ← tudo apertado

MOBILE (corrigido):
[img]  Turma: X
       Faixa: Y | Dia: Dom
       Progresso: ████ 3/13
       [Ver Escala]  [🗑]
```

Alteracoes especificas:
- Linha 348: Mudar `flex items-center` para `flex flex-col md:flex-row md:items-center`
- Linha 362: No mobile usar `grid-cols-1` ao inves de `grid-cols-2`
- Linha 397: Botoes no mobile ficam em linha separada com `w-full md:w-auto`
- Aplicar as mesmas correcoes nos cards de "Revistas Finalizadas" (linhas 456-526)

---

## Parte 2: Criar Aba "Escala Geral" com Todas as Turmas

### Objetivo
Uma nova aba que mostra todas as escalas de todas as turmas agrupadas por data, para que qualquer professor veja a programacao completa da igreja.

### Implementacao

**Arquivo:** `src/pages/ebd/Schedule.tsx`

#### 1. Nova aba no TabsList
Adicionar uma terceira aba "Escala Geral" ao lado de "Revistas Ativas" e "Revistas Finalizadas":

```tsx
<TabsList className="grid w-full max-w-lg grid-cols-3">
  <TabsTrigger value="ativas">Revistas Ativas</TabsTrigger>
  <TabsTrigger value="geral">Escala Geral</TabsTrigger>
  <TabsTrigger value="finalizadas">Revistas Finalizadas</TabsTrigger>
</TabsList>
```

#### 2. Nova query para buscar todas as escalas
Buscar todas as escalas ativas (futuras e recentes) de todas as turmas da igreja, com dados dos professores:

```tsx
const { data: escalaGeral } = useQuery({
  queryKey: ['ebd-escala-geral', churchData?.id],
  queryFn: async () => {
    // Buscar escalas com turma e professores
    // Agrupar por data
    // Retornar ordenado por data
  },
  enabled: !!churchData?.id,
});
```

#### 3. Layout da aba - Cards agrupados por data
Cada data tera um card com todas as turmas daquele dia:

```text
╔══════════════════════════════════════════════╗
║  📅 Domingo, 16 de Fevereiro de 2025        ║
╠══════════════════════════════════════════════╣
║                                              ║
║  Adultos          | Aula 5                   ║
║  👤 Pr. Cleuton / Pr. Valeney               ║
║                                              ║
║  12-14 anos       | Aula 5                   ║
║  👤 Prof. Renato                             ║
║                                              ║
║  15-17 anos       | Aula 5                   ║
║  👤 Prof. Lucas                              ║
║                                              ║
╚══════════════════════════════════════════════╝

╔══════════════════════════════════════════════╗
║  📅 Domingo, 23 de Fevereiro de 2025        ║
╠══════════════════════════════════════════════╣
║  ...                                         ║
╚══════════════════════════════════════════════╝
```

Cada turma dentro do card mostrara:
- Nome da turma e faixa etaria
- Numero da aula (extraido do campo `observacao`, ex: "Aula 5 - Titulo")
- Avatar(s) e nome(s) do(s) professor(es)
- Badge "Sem Aula" quando aplicavel

---

## Resumo das Alteracoes

| Arquivo | Alteracao |
|---------|-----------|
| `Schedule.tsx` | Corrigir layout responsivo dos cards (ativas + finalizadas) |
| `Schedule.tsx` | Adicionar aba "Escala Geral" com nova query |
| `Schedule.tsx` | Renderizar cards agrupados por data com todas as turmas |

## Detalhes Tecnicos

- A query da Escala Geral usara `ebd_escalas` filtrado por `church_id`, com joins em `ebd_turmas` e `ebd_professores`
- Agrupamento por data feito no frontend com `reduce()`
- O numero da aula sera extraido do campo `observacao` com regex `/Aula (\d+)/i`
- Layout responsivo: cards empilham verticalmente no mobile, lado a lado no desktop
- Nenhuma alteracao no banco de dados necessaria
