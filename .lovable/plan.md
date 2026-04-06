
Motivo atual: você não está caindo no leitor novo de livro no celular.

O que a captura mostra:
- A tela do print é da página `src/pages/revista/RevistaLeitura.tsx`
- Essa página exibe exatamente:
  - “Minha Biblioteca”
  - “Voltar às revistas”
  - “Nenhuma lição disponível no momento.”
- Esse fluxo é o portal `/revista/leitura`, que ainda trabalha com lista de lições

O que deveria acontecer para livro:
- Livro digital no fluxo novo abre em `src/pages/ebd/aluno/LivroDigitalLeitura.tsx`
- Essa tela usa `react-pdf`
- Se o PDF faltar, ela mostra “Conteúdo ainda não disponível.”
- Portanto, como sua tela mostra “Nenhuma lição disponível no momento”, o app não entrou nessa rota de livro

Diagnóstico mais provável agora:
1. O acesso foi feito pelo fluxo antigo `/revista/leitura`
   - Esse fluxo não usa a lógica nova de `AlunoRevistaVirtual.tsx`
   - Ele continua esperando lições
   - Como livro não tem lições, aparece “Nenhuma lição disponível no momento”

2. O redirecionamento para `/ebd/livro/:revistaId/ler` só existe em:
   - `src/pages/ebd/aluno/AlunoRevistaVirtual.tsx`
- Então só funciona quando o usuário entra por esse painel do aluno, não pelo portal antigo “Minha Biblioteca”

3. Mesmo com o upload corrigido, isso sozinho não conserta o fluxo antigo
   - O PDF pode até estar salvo agora
   - Mas a tela do print é outra página, com outra lógica

Arquivos relevantes identificados:
- `src/pages/ebd/aluno/AlunoRevistaVirtual.tsx`
  - já redireciona livro para `/ebd/livro/${assinatura.revista_id}/ler`
- `src/pages/ebd/aluno/LivroDigitalLeitura.tsx`
  - já usa `react-pdf`
- `src/pages/revista/RevistaLeitura.tsx`
  - ainda mostra lições e a mensagem “Nenhuma lição disponível no momento”

Plano de correção enxuto:
1. Revisar `src/pages/revista/RevistaLeitura.tsx`
   - detectar quando a revista selecionada é um livro (`leitura_continua === true` ou `tipo_conteudo === 'livro_digital'`)
2. Nesse caso, não renderizar a lista de lições
3. Exibir um botão único de leitura contínua para livro
4. Fazer esse botão abrir o PDF do livro no mesmo padrão mobile já usado no leitor novo
   - idealmente redirecionando para a rota de livro já existente
5. Confirmar que esse fluxo antigo também carrega `pdf_url`/metadados do livro no select

Detalhe técnico importante:
- Hoje o gargalo não parece ser mais o `react-pdf`
- O gargalo é de roteamento/fluxo: livro está sendo aberto numa página feita para revista com lições

Resultado esperado após ajuste:
- Se o usuário entrar pelo fluxo antigo e o item for livro, ele não verá mais “Nenhuma lição disponível”
- Em vez disso, verá um acesso direto ao PDF em modo contínuo no celular

<lov-actions>
<lov-suggestion message="Test the complete mobile flow end-to-end for a digital book, starting from the library screen until the PDF opens on the phone.">Verifique no celular</lov-suggestion>
<lov-suggestion message="Corrija o fluxo antigo em RevistaLeitura.tsx para detectar livros digitais e abrir o leitor de PDF em vez de mostrar lições vazias.">Corrigir fluxo antigo de livros</lov-suggestion>
<lov-suggestion message="Add a visible status indicator in the admin page showing whether each book already has a PDF linked in pdf_url.">Mostrar status do PDF no admin</lov-suggestion>
</lov-actions>
