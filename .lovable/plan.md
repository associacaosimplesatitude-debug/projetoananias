
# Plano: Adicionar Botão de Exclusão para Autores e Livros

## Resumo
Adicionar botões de exclusão nas listas de Autores e Livros, com confirmação antes de excluir. A exclusão removerá todos os dados relacionados (vendas, comissões, pagamentos, contratos, etc.).

## Análise das Dependências

Ao excluir um **Autor**, serão removidos automaticamente (CASCADE):
- Todos os livros do autor
- Comissões de cada livro
- Vendas de cada livro
- Pagamentos realizados
- Contratos
- Links de afiliado e cliques/vendas de afiliado
- Descontos por categoria

Ao excluir um **Livro**, serão removidos automaticamente (CASCADE):
- Comissões configuradas
- Todas as vendas do livro
- Contratos relacionados
- Links de afiliado do livro

## Alterações Necessárias

### 1. Migration SQL - Ajustar Constraint
A tabela `royalties_resgates` tem uma constraint que pode causar problemas. Vou alterar para CASCADE:

```sql
ALTER TABLE royalties_resgates
DROP CONSTRAINT royalties_resgates_autor_id_fkey;

ALTER TABLE royalties_resgates
ADD CONSTRAINT royalties_resgates_autor_id_fkey
FOREIGN KEY (autor_id) REFERENCES royalties_autores(id)
ON DELETE CASCADE;
```

### 2. Arquivo: `src/pages/royalties/Autores.tsx`
- Adicionar ícone `Trash2` aos imports
- Adicionar estado para controlar dialog de exclusão
- Adicionar componente `AlertDialog` para confirmação
- Adicionar função `handleDelete` que executa a exclusão
- Adicionar botão de exclusão ao lado do botão de edição

### 3. Arquivo: `src/pages/royalties/Livros.tsx`
- Adicionar ícone `Trash2` aos imports
- Adicionar estado para controlar dialog de exclusão
- Adicionar componente `AlertDialog` para confirmação
- Adicionar função `handleDelete` que executa a exclusão
- Adicionar botão de exclusão ao lado do botão de edição

## Interface Visual

Na coluna "Ações" de cada tabela, haverá dois botões:
- 📝 Editar (existente)
- 🗑️ Excluir (novo - vermelho)

Ao clicar em excluir, aparecerá um diálogo de confirmação com:
- Título: "Excluir [Autor/Livro]?"
- Descrição explicando que todos os dados serão excluídos
- Botões: "Cancelar" e "Excluir" (vermelho)

## Resultado Esperado

- Usuário poderá excluir autores e livros diretamente da lista
- Confirmação obrigatória antes da exclusão
- Todos os dados relacionados serão removidos automaticamente
- Lista atualizada automaticamente após exclusão

---

## Seção Técnica

### Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `supabase/migrations/xxx.sql` | Ajustar constraint de `royalties_resgates` |
| `src/pages/royalties/Autores.tsx` | Adicionar botão e lógica de exclusão |
| `src/pages/royalties/Livros.tsx` | Adicionar botão e lógica de exclusão |

### Queries de Exclusão

```typescript
// Excluir autor
await supabase.from("royalties_autores").delete().eq("id", autorId);

// Excluir livro
await supabase.from("royalties_livros").delete().eq("id", livroId);
```

### Invalidação de Cache

Após exclusão, invalidar queries:
- `royalties-autores`
- `royalties-livros`
- `royalties-vendas`
- `royalties-top-autores`
- `royalties-top-livros`
- `royalties-total-a-pagar`
