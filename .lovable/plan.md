# Player flutuante para o leitor da revista

## Problema atual

O `LicaoAudioPlayer` é renderizado como um bloco fixo dentro do header do leitor (`RevistaLeitura.tsx`, linhas 1051–1060), ocupando ~90–110px de altura. Como a imagem da página usa `h-[calc(100vh-120px)]` e o footer de navegação ("Anterior / Página X de Y / Próxima") é fixo, a soma estoura a viewport — o resultado é o rodapé do conteúdo cortado tanto no mobile quanto no desktop (visível no print enviado).

Além disso, o mesmo player também está em uso no modo rolagem contínua (`RevistaLeituraContinua` / `LeitorLeitura`) onde o sticky-collapse já existe — mudar para flutuante unifica a UX dos 3 leitores.

## Solução: FAB flutuante (estilo Spotify mini-player)

Reescrever o `LicaoAudioPlayer` em duas formas alternadas:

1. **Estado COLAPSADO (default)**: botão circular flutuante de 56px no canto inferior-direito, acima do footer de navegação. Mostra ícone Play/Pause + barra circular fina de progresso ao redor. Não ocupa fluxo do layout.
2. **Estado EXPANDIDO**: card flutuante de ~340px de largura, ancorado no mesmo canto, com título da lição, transport completo (−15s / play / +15s), slider de progresso, tempo, velocidade e botão "minimizar".

Como é `position: fixed`, o player **não rouba mais altura** do conteúdo — o corte do rodapé desaparece automaticamente nas 3 versões dos leitores.

```text
┌──────────────────────────┐    ┌──────────────────────────┐
│  Header                  │    │  Header                  │
├──────────────────────────┤    ├──────────────────────────┤
│                          │    │                          │
│                          │    │     [conteúdo full]      │
│     [conteúdo full]      │    │                          │
│                          │    │     ┌──────────────┐     │
│                          │    │     │ 🎧 Lição 1   │     │
│                          │    │     │ ◀ ▶ ▶ ──○─── │     │
│                       ◐  │    │     │ 0:12  / 8:07 │     │
├──────────────────────────┤    │     └──────────────┘     │
│  ◀ Anterior  1/5  Próx ▶ │    ├──────────────────────────┤
└──────────────────────────┘    │  ◀ Anterior  1/5  Próx ▶ │
   colapsado (FAB)              │   expandido               │
```

## Mudanças técnicas

**1. `src/components/revista/LicaoAudioPlayer.tsx`** — reescrita

- Remover `position: sticky` + sentinel + IntersectionObserver de stuck. Não precisa mais.
- Manter o IntersectionObserver de `data-licao-id` apenas no modo "scroll contínuo" (auto-troca entre lições) — só ativar se `containerRef.current.closest('[data-licao-id]')` existir.
- Wrapper externo passa a ser `position: fixed`, `bottom: 72px` (acima do footer de navegação), `right: 16px`, `zIndex: 40`.
- Default `expanded = false` (só FAB ao abrir). Persistir preferência em `localStorage` (`licao_audio_expanded`).
- Estado COLAPSADO: botão redondo 56×56 com SVG circular de progresso (stroke gold), ícone Play/Pause central. Click curto = play/pause. Click no badge "expandir" (chevron pequeno) = expande.
- Estado EXPANDIDO: card 340px (mobile: `calc(100vw - 32px)` máx 360), com header (título + minimizar) + linha de transport + slider + speed.
- Quando audio está tocando e player está colapsado, mostrar barra de progresso circular animada + um pulse sutil.
- Manter persistência de posição em `licao_audio_pos_${licaoId}` (já existe).
- Manter integração com `LicaoAudioContext` (pause os outros, etc.).

**2. `src/pages/revista/RevistaLeitura.tsx`** (linhas 1051–1060)

- Remover o `<div style={{ padding: "8px 12px", backgroundColor: '#1c1915', ...}}>` wrapper.
- Renderizar `<LicaoAudioPlayer />` diretamente como filho do container `LicaoAudioProvider` (continua dentro do provider, mas fora do flex column — vai como overlay fixed).
- Footer nav fica intacto. Conteúdo recupera espaço vertical inteiro.

**3. `src/pages/revista/RevistaLeituraContinua.tsx`** e **`src/pages/leitor/LeitorLeitura.tsx`**

- Mesma simplificação: remover qualquer wrapper/padding que esteja envolvendo o player. Como agora ele é fixed/overlay, basta mantê-lo dentro do `LicaoAudioProvider` em qualquer ponto do JSX.
- No modo scroll contínuo (várias lições empilhadas), a lógica de "qual lição é a visível" continua valendo via `setVisibleLicao`. O FAB sempre mostra a lição visível atual (única instância renderizada por lição, mas o context ainda permite trocar pause entre elas).

**4. Posicionamento responsivo**

- Mobile (<768px): FAB `right: 12px`, `bottom: 76px` (acima do footer de 56px). Card expandido `width: calc(100vw - 24px)`, `right: 12px`.
- Desktop: FAB `right: 24px`, `bottom: 88px`. Card expandido `width: 360px`.
- Em ambos: usar `safe-area-inset-bottom` para iOS PWA.

## Critérios de aceite

- Página da lição (img/conteúdo) ocupa 100% do espaço entre header e footer — sem corte do rodapé em mobile (375px) e desktop (1366px+).
- FAB visível e clicável em todas as páginas da lição (modo setas e modo rolagem).
- Expandir/minimizar funciona com 1 clique e a preferência persiste entre lições.
- Posição do áudio continua salva em `licao_audio_pos_<licaoId>`.
- Em scroll contínuo, ao rolar entre lições o FAB pausa a anterior (já garantido pelo context).
- Player não sobrepõe os botões "Anterior/Próxima" do footer.
