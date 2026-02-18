

# Redesign Premium do Dashboard do Superintendente

## Visao Geral
Transformar o dashboard atual em um painel moderno, profissional e futurista usando as cores da marca: **#1b191c** (preto escuro) e **#f4b328** (dourado/amber). Inspirado nos exemplos enviados com cards elegantes, graficos estilizados e visual dark premium.

## Paleta de Cores da Marca
- **Primario escuro**: #1b191c (fundo de cards destaque, sidebar)
- **Dourado/Amber**: #f4b328 (acentos, icones, destaques, botoes)
- **Superficies**: tons de cinza escuro para profundidade
- **Textos**: branco sobre fundos escuros, cinza claro para secundarios

## Mudancas Visuais

### 1. Header Redesenhado
- Saudacao personalizada com hora do dia ("Bom dia, Superintendente")
- Nome da igreja em destaque com badge dourado
- Botoes de acao com estilo dourado (outline com borda amber)
- Data atual formatada

### 2. Cards de Metricas (KPI Cards)
- Background escuro (#1b191c) com bordas sutis
- Numeros grandes em dourado (#f4b328) para destaque
- Icones dentro de circulos com fundo dourado translucido
- Efeito de hover com elevacao e brilho sutil
- Animacao fade-in ao carregar

### 3. Cards Informativos (Aniversariantes, Ofertas, Creditos)
- Fundo com gradiente escuro sutil ao inves de cores pasteis
- Bordas com acento dourado
- Icones em dourado

### 4. Graficos Estilizados
- Fundo escuro nos containers de graficos
- Linhas e barras em dourado (#f4b328) e branco
- Grid sutil em cinza escuro
- Tooltips com estilo dark

### 5. Ranking e Listas
- Items com fundo escuro e hover dourado
- Medalhas (1o, 2o, 3o) com gradientes dourados
- Badges com estilo premium

### 6. Cards de Revistas e Turmas
- Progress bars com cor dourada
- Separadores visuais mais elegantes

## Secao Tecnica

### Arquivo modificado: `src/pages/ebd/Dashboard.tsx`

Todas as mudancas sao visuais (classNames e estilos inline). Nenhuma logica de dados sera alterada.

**Principais alteracoes de classes CSS:**

1. **KPI Cards** - Trocar `bg-gradient-to-br from-blue-500/10...` por classes com fundo escuro e acentos dourados:
   ```
   bg-[#1b191c] text-white border-[#f4b328]/20
   ```

2. **Numeros destaque** - Trocar cores individuais (blue-600, green-600, etc) por dourado:
   ```
   text-[#f4b328]
   ```

3. **Icone containers** - Circulo com fundo dourado translucido:
   ```
   bg-[#f4b328]/20
   ```

4. **Icones** - Cor dourada uniforme:
   ```
   text-[#f4b328]
   ```

5. **Header** - Saudacao com hora do dia + estilo refinado

6. **Botoes** - Botao primario com fundo dourado, secundario com outline dourado:
   ```
   bg-[#f4b328] text-[#1b191c] hover:bg-[#f4b328]/90
   ```

7. **Cards de graficos** - Background escuro, cores douradas nos graficos:
   ```
   stroke="#f4b328" para linhas
   fill="#f4b328" para barras/pie
   ```

8. **Ranking medalhas** - Gradiente dourado para o 1o lugar, prata e bronze mantidos

9. **Cards informativos** (aniversariantes, ofertas) - Fundo escuro com bordas douradas ao inves de pasteis coloridos

10. **Progress bars** - Indicador dourado

### Arquivo modificado: `src/index.css`
- Nenhuma alteracao necessaria -- as cores serao aplicadas inline via classes Tailwind arbitrarias `[#1b191c]` e `[#f4b328]`

### Componentes auxiliares inalterados
- `OnboardingProgressCard`, `TaxaLeituraSemanalCard`, `BirthdayCouponModal` - permanecem como estao (podem ser ajustados numa segunda iteracao)

### Animacoes
- Cards KPI com `animate-fade-in` escalonado
- Hover nos cards com `transition-all duration-300 hover:shadow-lg hover:shadow-[#f4b328]/10`

