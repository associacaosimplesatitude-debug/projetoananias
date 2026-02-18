

# Redesign SaaS Premium - Dashboard do Superintendente

## Problema Atual
O dashboard esta 100% com fundo escuro (#1b191c) em todos os cards, criando uma interface pesada, monolitica e sem respiro visual. Parece um template generico, nao um SaaS premium.

## Nova Diretriz de Design

### Filosofia
Inspirado em Stripe, Linear, Vercel e Notion: fundo claro, espacos generosos, tipografia refinada, cor dourada apenas como acento pontual.

### Paleta Revisada
- **Base**: branco / cinza muito claro (bg-white, bg-gray-50)
- **#1b191c**: APENAS no header principal (saudacao)
- **#f4b328**: APENAS para botoes primarios, icones ativos, progress bars, badges de destaque
- **Textos**: gray-900 para titulos, gray-500 para subtextos
- **Bordas**: gray-200 (sutis, quase invisiveis)
- **Sombras**: shadow-sm, muito sutis

## Mudancas Detalhadas

### 1. Header (saudacao)
- Manter fundo escuro #1b191c APENAS aqui (unico bloco escuro)
- Simplificar: remover shadow-lg exagerado
- Border-radius 16px (rounded-2xl)
- Botoes: primario dourado, secundario outline clean

### 2. KPI Cards (4 metricas)
- Fundo **branco** com borda gray-200
- Sombra sutil (shadow-sm)
- Valor numerico em gray-900 (preto), nao dourado
- Icone em circulo com fundo #f4b328/10 e icone #f4b328
- Label em gray-500
- Border-radius 12px+ (rounded-xl)
- Hover suave: shadow-md

### 3. Card de Creditos
- Fundo branco, borda gray-200
- Valor em #f4b328 (destaque unico)
- Icone dourado translucido

### 4. Cards Informativos (Aniversariantes, Ofertas)
- Fundo branco
- Titulos em gray-900
- Icones em #f4b328
- Subtextos em gray-500
- Bordas cinza claras

### 5. Ranking de Alunos
- Fundo branco
- Items com hover bg-gray-50
- Medalha 1o lugar: dourada
- Nomes em gray-900
- Pontos em #f4b328

### 6. Graficos (Frequencia, Distribuicao)
- Container com fundo branco
- Grid do grafico em gray-100
- Linha/barras em #f4b328
- Eixos em gray-400
- Tooltip com fundo branco, borda gray-200

### 7. Cards Escala (professor)
- Fundo branco
- Badge de data com bg-amber-50 e texto #f4b328
- Avatars com borda branca

### 8. Revistas em Uso
- Fundo branco
- Progress bar: trilha gray-100, indicador #f4b328
- Texto de progresso em gray-500

### 9. Turmas Ativas
- Fundo branco
- Items com bg-gray-50 no hover
- Badge de contagem com bg-amber-50 e texto amber-700

## Secao Tecnica

### Arquivo modificado: `src/pages/ebd/Dashboard.tsx`

Todas as mudancas sao CSS (classNames). Nenhuma logica de dados sera alterada.

**Padrao de substituicao em TODOS os cards:**

| De (atual) | Para (novo) |
|---|---|
| `bg-[#1b191c]` | `bg-white` |
| `border-[#f4b328]/15` | `border-gray-200` |
| `text-white` | `text-gray-900` |
| `text-white/60` | `text-gray-500` |
| `text-white/40` | `text-gray-400` |
| `text-white/50` | `text-gray-400` |
| `hover:shadow-[#f4b328]/10` | `hover:shadow-md` |
| `bg-white/5` | `bg-gray-50` |
| `bg-white/10` | `bg-gray-100` |
| `hover:bg-[#f4b328]/5` | `hover:bg-gray-50` |
| `text-[#f4b328]` em valores KPI | `text-gray-900` |

**Excecoes (mantem dourado):**
- Header saudacao: manter `bg-[#1b191c]`
- Icones dentro de circulos: manter `text-[#f4b328]`
- Botao primario: manter `bg-[#f4b328]`
- Progress bars: manter `bg-[#f4b328]`
- Pontos do ranking: manter `text-[#f4b328]`
- Badge da igreja: manter dourado

**Graficos (Recharts):**
- CartesianGrid: `stroke="rgba(0,0,0,0.06)"`
- XAxis/YAxis: `stroke="rgb(156,163,175)"` e tick fill gray
- Tooltip contentStyle: `backgroundColor: '#fff'`, `border: '1px solid #e5e7eb'`, `color: '#111827'`
- Manter linha/pie em `#f4b328`

**Espacamento:**
- Container principal: manter `space-y-6`
- Cards: `rounded-xl` (12px+)
- Padding interno dos cards: manter `p-4` / `p-6`

Nenhum arquivo adicional precisa ser modificado.
