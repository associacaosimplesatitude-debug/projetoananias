
Problema encontrado: o conteúdo não aparece no celular por causa de uma falha no fluxo da página pública “Minha Biblioteca” (`/revista/leitura`), e não por falta de vínculo do livro.

O que verifiquei
- O livro `12` existe em `revistas_digitais`.
- Ele está correto no banco:
  - `tipo_conteudo = livro_digital`
  - `leitura_continua = true`
  - `pdf_url` preenchido
  - `total_licoes = 0`
- O comportamento da imagem do celular bate exatamente com o código atual.

Por que não aparece no celular
1. A tela pública `src/pages/revista/RevistaLeitura.tsx` só mostra o botão “Modo Leitura” dentro do bloco que exige `licoes.length > 0`.
2. Como o livro `12` tem `0` lições, a tela entra neste trecho:
   - mostra capa e título
   - depois renderiza apenas: “Nenhuma lição disponível no momento.”
3. Ou seja: mesmo com `pdf_url` válido, o botão de abrir o livro não aparece.
4. Além disso, no mesmo arquivo, quando o “Modo Kindle” abre no mobile, ele usa as imagens das lições (`licoes.map(...)`) em vez do PDF.
5. Como esse livro não tem lições, mesmo que entrasse nesse modo, no mobile continuaria vazio.

Conclusão objetiva
O problema não é “licença faltando”.
O problema é a lógica da página pública/mobile:
- livro digital com `pdf_url` e sem lições
- botão de leitura escondido
- modo mobile dependente de lições em vez de PDF

Arquivos que precisam ser corrigidos
1. `src/pages/revista/RevistaLeitura.tsx`
- Separar a lógica de “livro digital / leitura contínua” da lógica de “lições”.
- Exibir o botão “Modo Leitura” sempre que a revista tiver `pdf_url` ou `leitura_continua = true`, mesmo com `0` lições.
- Se `revista.leitura_continua === true`, não mostrar a mensagem “Nenhuma lição disponível no momento.” como tela principal do livro.
- No mobile, usar o mesmo `<iframe>` direto com `pdf_url` também para livros digitais, em vez de depender de `licoes.map(...)`.

2. Validar a origem dos dados carregados em `localStorage`
- Confirmar que `data.licencas` retornado no acesso público já traz `pdf_url` e `leitura_continua`.
- Se não trouxer, ajustar a origem para incluir esses campos, porque `RevistaLeitura.tsx` já depende deles.

Ajuste de implementação recomendado
- Regra da tela pública:
  - Se `revista.leitura_continua === true` e existe `pdf_url`:
    - mostrar botão “Modo Leitura”
    - abrir PDF por iframe no desktop e no mobile
    - não exigir lições
  - Se `revista.leitura_continua !== true`:
    - manter comportamento atual baseado em lições
- Regra visual:
  - “Nenhuma lição disponível no momento” só deve aparecer para revistas normais sem conteúdo, não para livros digitais com PDF completo.

Resumo do diagnóstico
```text
Livro 12:
- existe no banco: SIM
- leitura_continua: true
- pdf_url: preenchido
- lições: 0

Falha real:
- página /revista/leitura esconde o botão de leitura quando lições = 0
- mobile do modo Kindle usa lições/imagens, não o PDF
- resultado: no celular aparece só capa + título + “Nenhuma lição disponível no momento”
```

Plano de correção
1. Corrigir `RevistaLeitura.tsx` para reconhecer livro digital sem lições como conteúdo válido.
2. Mostrar o botão de leitura independentemente de `licoes.length`.
3. Fazer o mobile abrir o PDF por iframe direto usando `pdf_url`.
4. Manter o comportamento atual intacto para revistas normais com lições.
