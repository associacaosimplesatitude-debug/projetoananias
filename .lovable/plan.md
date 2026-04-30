
# Mini-player de áudio: versão discreta

## Problema observado (screenshot)

- Player dourado conflita com a faixa laranja "Lição 1" logo abaixo
- Está colado no header escuro (sem respiro)
- Título da lição aparece **duplicado** (no header preto e dentro do player)
- Largura grande demais ocupa quase toda a área útil

## Solução

Tornar o player **menor, mais neutro e deslocado**, sem repetir informação que já está no header.

### Mudanças em `src/components/revista/LicaoAudioPlayer.tsx`

**1. Posicionamento — descer e encostar mais à direita**
- `top: calc(96px + env(safe-area-inset-top))` (antes: 48px) — fica abaixo da faixa "Lição 1", sobre a imagem
- `right: max(12px, env(safe-area-inset-right))`

**2. Tamanho — pill compacto**
- Altura: 36px (antes 44px)
- Largura mobile: `auto`, `max-width: 200px` (antes 300px)
- Largura desktop: `auto`, `max-width: 240px`

**3. Conteúdo — remover título duplicado**
- Layout: `[▶/⏸]  [00:01 / 08:07]  [⤢]`
- Sem o "🎧 Lição 1 - A Posição..." (já está no header)
- Ícone de fone discreto à esquerda do tempo, opcional

**4. Paleta — neutra escura, não dourada**
- Fundo: `rgba(20,20,20,0.85)` com `backdrop-filter: blur(8px)`
- Borda: `rgba(255,255,255,0.12)` (antes dourada)
- Texto/ícone tempo: `rgba(255,255,255,0.85)`
- Botão play/pause: círculo `rgba(255,255,255,0.95)` com ícone `#1c1915` — destaque sem competir com o dourado da faixa
- Barra de progresso inferior (2px): branca translúcida `rgba(255,255,255,0.6)` em vez de dourada
- Botão expandir: contorno branco translúcido

**5. Card expandido — manter dourado**
- O card expandido (quando o usuário clica em ⤢) continua com a identidade dourada do Leitor CG
- Apenas o estado **colapsado** fica neutro para não competir com o conteúdo

## Critério de aceite

- Player não compete visualmente com a faixa "Lição 1"
- Sem duplicação de título
- Cabe confortavelmente no canto sem cobrir a imagem da lição
- Transport (play/pause + tempo) ainda legível à distância normal de leitura
