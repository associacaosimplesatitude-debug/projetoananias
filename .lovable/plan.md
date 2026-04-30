## Objetivo

1. Renomear o item de menu "Revistas Digitais" para **"Produtos Digitais"** no sidebar admin.
2. Na página `/admin/ebd/revistas-digitais`, adicionar um **filtro por categoria** (Revista EBD, Livro Digital, Infográficos) sobre a lista existente.

Sem alterações de banco, rotas, lógica de criação/edição ou fluxos correlatos.

## Alterações

### 1. `src/components/admin/AdminEBDLayout.tsx` (linha 526)
- Trocar o texto `Revistas Digitais` por `Produtos Digitais` no `SidebarMenuButton` que aponta para `/admin/ebd/revistas-digitais`. Rota e ícone permanecem os mesmos.

### 2. `src/pages/admin/RevistasDigitais.tsx`
- Atualizar o título do header (linha 1171) de "Revistas Digitais" para **"Produtos Digitais"** e o subtítulo para algo como "Gestão de revistas, livros digitais e infográficos".
- Adicionar um state `filtroCategoria` com valores: `todos | revista | livro_digital | infografico` (default `todos`).
- Adicionar um componente `Tabs` (ou `Select`) logo abaixo do header — usar `Tabs` com 4 abas: **Todos**, **Revista EBD**, **Livro Digital**, **Infográficos**, seguindo o padrão visual já usado em outras páginas admin.
- Aplicar filtro na renderização da lista (linha 1562): usar `revistas?.filter(r => filtroCategoria === 'todos' || (r as any).tipo_conteudo === filtroCategoria || (filtroCategoria === 'revista' && !(r as any).tipo_conteudo))` para incluir registros legados sem `tipo_conteudo` na aba "Revista EBD".
- Mostrar contador de itens em cada aba (opcional, leve).

## Fora do escopo
- Nenhuma mudança no schema `revistas_digitais` (campo `tipo_conteudo` já existe e é usado).
- Nenhuma mudança nos formulários de criação/edição, uploads, quizzes, licenças ou Revistas Assinaturas.
- Nenhuma alteração de rota — apenas o label do menu e UI da listagem.
