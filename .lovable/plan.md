
Diagnóstico

- O botão apareceu porque o fluxo legado `/revista/leitura` já reconhece o item como livro digital.
- O `pdf_url` do livro `teste` existe e está preenchido corretamente.
- O motivo de funcionar no computador e não no iPhone é o render atual do livro nesse fluxo legado:
  - em `src/pages/revista/RevistaLeitura.tsx`
  - quando `modoKindle` está ativo e `isMobile === true`
  - o código abre o PDF com `<iframe src="{pdf_url}#toolbar=0&view=FitH" />`
- iPhone/Safari costuma falhar ou limitar PDF embutido em `iframe`, especialmente em viewer interno dentro de app web. Isso bate exatamente com o sintoma: no desktop abre, no iPhone não.

Evidências lidas no código

- `src/pages/revista/RevistaLeitura.tsx`
  - detecção mobile:
    - `window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)`
  - fluxo do botão “Ler Livro”:
    - ativa `setModoKindle(true)`
  - render mobile do livro:
    - usa `iframe` com `src={`${revista.pdf_url}#toolbar=0&view=FitH`}`
- `src/pages/ebd/aluno/LivroDigitalLeitura.tsx`
  - usa `react-pdf`, que é justamente a abordagem mais compatível para iPhone
- `src/App.tsx`
  - a rota `/ebd/livro/:revistaId/ler` está protegida por `ProtectedRoute`
  - então ela não serve diretamente para o portal OTP da “Minha Biblioteca”
- snapshot de rede
  - o registro da revista `teste` mostra:
    - `tipo_conteudo: "livro_digital"`
    - `leitura_continua: true`
    - `pdf_url` preenchido

Causa raiz atual

- Não é mais falta de PDF.
- Não é mais falta de flag `leitura_continua`.
- O gargalo agora é exclusivamente de compatibilidade no iPhone:
  - o fluxo legado de livros ainda usa `iframe` no mobile
  - o iPhone precisa de renderização tipo `react-pdf` no próprio frontend, não embed nativo por `iframe`

Plano de correção

1. Atualizar `src/pages/revista/RevistaLeitura.tsx`
- Substituir apenas o render mobile do livro digital no `modoKindle`
- Em vez de `<iframe>`, usar `react-pdf` com:
  - `<Document file={revista.pdf_url}>`
  - múltiplos `<Page>` em scroll vertical contínuo
  - `ResizeObserver` + largura responsiva do container
  - header atual preservado
  - modo noturno preservado no que for possível visualmente

2. Manter revistas comuns intactas
- Não mexer no fluxo atual de revistas EBD com imagens das lições
- A mudança deve valer só para:
  - `revista.leitura_continua === true`
  - ou `tipo_conteudo === "livro_digital"`

3. Manter o portal OTP compatível
- Fazer tudo dentro de `RevistaLeitura.tsx`
- Não redirecionar para `/ebd/livro/:revistaId/ler`
- Assim não quebramos o acesso da “Minha Biblioteca”, que não usa o login autenticado normal

4. Preservar comportamento existente
- botão “← Voltar”
- título
- bloqueio de menu de contexto, se já existir no reader
- fallback “PDF não disponível” se `pdf_url` vier vazio

5. Validar cenário alvo
- Livro `teste` abrindo:
  - desktop: continua funcionando
  - iPhone: passa a renderizar páginas do PDF em scroll contínuo sem depender do viewer nativo do Safari

Detalhe técnico

- A dependência `react-pdf` já está em uso no projeto em `LivroDigitalLeitura.tsx`
- Então o ajuste ideal é reaproveitar o mesmo padrão de leitura contínua no fluxo legado, sem depender de `iframe` no mobile para livros digitais
