
Diagnóstico

- Do I know what the issue is? Sim.
- A rota está correta e leva para `LivroDigitalLeitura.tsx`.
- O problema real não é mais o parâmetro da rota; é a estratégia de render no mobile.
- Hoje o componente ainda mantém caminho de PDF no celular:
  - tenta priorizar imagens, mas ainda permite `usePdf` no mobile quando `paginasImagens` não chegou ainda ou vier vazio
  - isso é insuficiente para “garantir” iPhone, porque o `react-pdf` continua podendo entrar no fluxo e exibir `Erro ao carregar o PDF`

Arquivos envolvidos

- `src/pages/ebd/aluno/LivroDigitalLeitura.tsx`
- Não preciso mexer em rota nem em `AlunoRevistaVirtual.tsx`, porque o redirecionamento já está correto para `/ebd/livro/:revistaId/ler`

Plano de implementação

1. Tornar o mobile “image-only”
- Em `LivroDigitalLeitura.tsx`, quando `isMobile` for true:
  - nunca renderizar `<Document>`
  - ignorar completamente `pdf_url`
  - usar apenas o array `paginas` vindo de `revista_licoes` (`numero = 1`)

2. Separar claramente os fluxos desktop e mobile
- Desktop:
  - mantém PDF como principal
  - imagens continuam como fallback se não houver PDF
- Mobile:
  - imagens como única fonte
  - PDF não entra em nenhuma condição de render

3. Adicionar estado de carregamento das imagens no mobile
- Enquanto a query de `revista_licoes` estiver carregando:
  - mostrar algo como “Carregando páginas...”
- Isso evita que o componente entre cedo demais no ramo do PDF antes da resposta do banco

4. Ajustar condição de tela vazia
- No mobile:
  - se não houver imagens, mostrar mensagem específica de conteúdo indisponível no celular
- No desktop:
  - mantém comportamento atual de PDF/imagens

5. Preservar o modo atual de leitura por imagens
- Reaproveitar o renderer já existente de scroll contínuo:
  - `paginasImagens!.map(...)`
- Manter:
  - marca d’água
  - `loading="lazy"`
  - bloqueio de menu de contexto
  - layout em rolagem vertical contínua

Resultado esperado

- iPhone/Android:
  - livro digital abre sempre pelas imagens
  - nunca aparece “Erro ao carregar o PDF” porque o PDF deixa de ser usado no celular
- Desktop:
  - continua usando PDF normalmente
  - fallback por imagens continua disponível

Detalhe técnico

- Hoje o trecho crítico é este conceito:
  - `const usePdf = isMobile ? (!hasImages && !!pdfUrl) : !!pdfUrl;`
- Para garantir mobile, ele precisa virar lógica efetivamente equivalente a:
  - mobile: `usePdf = false`
  - mobile: `useImages = hasImages`
- Além disso, a UI deve respeitar o `isLoading` da query de páginas antes de decidir o que renderizar
