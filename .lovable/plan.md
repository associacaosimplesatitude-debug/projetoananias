## Problema

Nas imagens enviadas (iPad em `gestaoebd.com.br`), a última linha do texto da revista digital fica cortada/escondida na parte de baixo da tela. O mesmo acontece no celular.

**Causa:** Os leitores usam `fixed inset-0` (equivalente a `height: 100vh`). No Safari iOS/iPadOS, `100vh` representa a viewport **sem** a barra de URL dinâmica — então quando a barra aparece, o rodapé do leitor (e a última linha das imagens da revista) some atrás dela. Também não há respeito à `safe-area-inset-bottom`.

No `RevistaLeitor.tsx` há ainda `max-h-[calc(100vh-120px)]` no `<img>`, que sofre do mesmo problema.

## Solução

Trocar a altura fixa por **dynamic viewport height (`100dvh`)**, que se ajusta automaticamente à barra do Safari, e adicionar **padding seguro** (`env(safe-area-inset-bottom)`) na barra inferior dos leitores. Sem mudanças em lógica/negócio — só CSS de layout.

### Arquivos a alterar

1. **`src/pages/ebd/aluno/RevistaLeituraContinua.tsx`**
   - Trocar `fixed inset-0` por container com `height: 100dvh` (mantendo posicionamento fixo).
   - Adicionar `paddingBottom: env(safe-area-inset-bottom)` no scroll container.

2. **`src/pages/ebd/aluno/RevistaLeitor.tsx`**
   - Mesmo ajuste de altura (`100dvh`).
   - Alterar `max-h-[calc(100vh-120px)]` para `max-h-[calc(100dvh-140px)]` no `<img>` do modo "setas", para a imagem não passar por trás da barra de navegação inferior.
   - Adicionar safe-area no rodapé "Anterior / Próxima".

3. **`src/pages/ebd/aluno/LivroDigitalLeitura.tsx`**
   - Aplicar o mesmo padrão (`100dvh` + safe-area) para consistência, já que tem a mesma estrutura `fixed inset-0`.

### Detalhes técnicos

- Padrão a usar:
  ```tsx
  <div
    className="fixed inset-x-0 top-0 z-50 bg-slate-950 flex flex-col select-none"
    style={{ height: "100dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
  >
  ```
- `100dvh` tem suporte em Safari iOS 15.4+ (todos os iPads/iPhones atuais).
- Memory existente sobre Mobile/PWA (rolagem contínua no mobile) continua valendo — não vou mexer nessa regra.

## Verificação

Após aplicar, abrir `/ebd/aluno/revista/:id/licao/:n` e `/ebd/aluno/revista/:id/continua` no iPad e celular e confirmar que a última linha do texto fica visível com a barra de URL do Safari visível.