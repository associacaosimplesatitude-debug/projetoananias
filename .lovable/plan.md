
Objetivo corrigido (alinhado com seu pedido):
1) O PDF completo permanece no modal admin (como está).
2) O aluno vê esse PDF ao clicar em “Leitura Contínua”.
3) As lições continuam no fluxo por imagens (sem distribuição automática de PDF por lição).
4) Restaurar o que for possível das imagens já existentes.

Diagnóstico do que está errado hoje:
- Em `src/pages/admin/RevistasDigitais.tsx`, `handleGlobalPdfUpload` está convertendo PDF em PNG e sobrescrevendo `revista_licoes.paginas` (isso alterou o conteúdo das lições).
- Em `src/pages/ebd/aluno/RevistaLeituraContinua.tsx`, a tela de leitura contínua só lê imagens das lições e não tenta abrir um PDF completo.
- O upload de imagens por lição já existe no código atual e será mantido exatamente.

Plano de correção:
1) Corrigir upload global do modal (sem mexer nas lições)
- Arquivo: `src/pages/admin/RevistasDigitais.tsx`
- Manter o bloco “PDF Completo” no modal.
- Trocar a lógica de `handleGlobalPdfUpload` para:
  - fazer upload único do arquivo em caminho fixo da revista (ex.: `{revistaId}/completo.pdf`, com upsert),
  - NÃO atualizar `revista_licoes`,
  - NÃO converter PDF em páginas.
- Remover a lógica de distribuição automática entre lições (causa da sobrescrita).

2) Fazer “Leitura Contínua” do aluno abrir o PDF completo
- Arquivo: `src/pages/ebd/aluno/RevistaLeituraContinua.tsx`
- Adicionar busca do PDF completo da revista no storage (caminho fixo).
- Comportamento:
  - se existir PDF: renderizar visualização do PDF nessa rota de leitura contínua;
  - se não existir: manter fallback atual (scroll contínuo das imagens das lições).
- Manter botão de fechar e proteção visual existente.

3) Garantir que lições continuem no modo imagem
- Arquivo: `src/pages/admin/RevistasDigitais.tsx`
- Preservar intactos:
  - upload manual de imagens por lição,
  - reordenação de páginas,
  - remoção de página,
  - quiz IA.

4) Restaurar imagens “apagadas” (parte de dados)
- Vou aplicar restauração não-destrutiva das referências de páginas a partir dos arquivos que ainda estão no storage da revista (sincronizando `revista_licoes.paginas` com os arquivos existentes por lição/ordem).
- Limitação técnica importante: se algum arquivo foi sobrescrito no mesmo nome, não existe como recuperar a versão antiga automaticamente; nesse caso, só reenvio manual desses arquivos específicos.

Arquivos impactados:
- `src/pages/admin/RevistasDigitais.tsx` (corrigir upload global para PDF único, sem distribuição)
- `src/pages/ebd/aluno/RevistaLeituraContinua.tsx` (priorizar exibição do PDF no botão Leitura Contínua)
- (se necessário para restauração de dados) uma migração SQL de sincronização de `paginas` com arquivos existentes

Detalhes técnicos (resumo):
- Não preciso alterar autenticação.
- Não preciso criar nova role/política para essa correção de comportamento.
- A leitura do arquivo no storage já está coberta por política de leitura autenticada no bucket `revistas`.
