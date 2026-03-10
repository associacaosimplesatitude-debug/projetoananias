

## Plano: Melhorar formulário de Revistas Digitais no Admin

### 1. Migração: adicionar colunas à tabela `revistas_digitais`

Novos campos:
- `descricao` (text, nullable) — descrição/tema
- `autor` (text, nullable) — autor/organizador
- `ano_publicacao` (integer, default extract year from now)
- `status_publicacao` (text, default 'rascunho') — rascunho | publicada | arquivada

### 2. Reescrever `src/pages/admin/RevistasDigitais.tsx`

**Formulário (Dialog max-w-2xl, dois painéis):**
- **Painel esquerdo:** campos do formulário
  - Título, Tipo (select), Trimestre
  - Descrição/tema (textarea)
  - Autor/organizador (text)
  - Ano de publicação (number, default 2026)
  - Status: Rascunho | Publicada | Arquivada (select)
  - Total de lições (apenas em criação)
- **Painel direito:** área de upload da capa
  - Drag-and-drop zone com preview
  - Upload para Storage `revistas/capas/{uuid}.jpg`
  - Thumbnail 120x160px após upload
  - Remove campo "URL da Capa" textual

**Botão salvar:** laranja (`bg-orange-500`) com ícone

**Fluxo pós-cadastro (criação):**
- Após salvar nova revista, `setManagingLicoes(data)` automaticamente para redirecionar à gestão de lições

### 3. Melhorar gestão de lições (dentro do mesmo componente)

- Upload com drag-and-drop por lição
- Thumbnails das páginas com reordenação (drag to reorder via estado local + save)
- Path no Storage: `revistas/{revista_id}/licao-{numero}/{ordem}.jpg`
- Botão "Visualizar como aluno" que navega para `/ebd/revista/{revistaId}/licao/{numero}`

### Arquivos alterados
- **Migração SQL** — adicionar 4 colunas a `revistas_digitais`
- **`src/pages/admin/RevistasDigitais.tsx`** — reescrita completa do formulário e gestão de lições

