# Reposicionar player no canto superior direito

## Problema

O FAB no canto inferior direito está colidindo com o botão de anotações que já existe nessa região.

## Solução

Mover o `LicaoAudioPlayer` para o **canto superior direito**, sobreposto à imagem da página, logo abaixo do header da lição. Em vez de FAB redondo, usar formato de **mini-player horizontal** sempre visível (não esconde o transport).

## Mudança em `src/components/revista/LicaoAudioPlayer.tsx`

**1. Posicionamento (substitui o bloco fixed atual)**
- `position: fixed`
- `top: calc(48px + env(safe-area-inset-top))` — fica logo abaixo do header (~44px)
- `right: max(8px, env(safe-area-inset-right))` (mobile) / `right: 16px` (desktop)
- `zIndex: 40`

**2. Forma colapsada = mini-player horizontal (não FAB redondo)**
- Pill com fundo `#1c1915`, borda `rgba(246,186,50,0.35)`, raio 999px, sombra
- Layout horizontal (h ~44px): `[▶/⏸]  [titulo curto trunc]  [00:42 / 08:07]  [⤢ expandir]`
- Mobile: largura `min(280px, calc(100vw - 24px))` — título trunca
- Desktop: largura ~320px
- Barra de progresso fina (2px) na borda inferior do pill, dourada

**3. Forma expandida (mantém)**
- Mesmo card de 360px que já existe, ancorado no mesmo `top/right`
- Botão minimizar volta para o pill

**4. Default colapsado** (preferência continua persistindo em `licao_audio_expanded`)

## Critérios

- Player visível e legível no topo direito da imagem em mobile (375px) e desktop
- Não sobrepõe os botões de anotação/quiz (que ficam em outras regiões: inferior, lateral esquerda)
- Transport (play/pause) acessível sem precisar expandir
- Preferência expandido/minimizado persiste
