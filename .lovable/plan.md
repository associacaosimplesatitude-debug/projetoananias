
# Plano: Adicionar Botão para Criar Novo Link de Afiliado

## Objetivo
Adicionar um botão "Novo Afiliado" na página `/royalties/afiliados` que abre um dialog para cadastrar novos links de afiliado com os campos: Autor, Livro, Comissão e Link da Landing Page.

---

## Estrutura Atual da Tabela `royalties_affiliate_links`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | uuid | Chave primária |
| `autor_id` | uuid | FK para `royalties_autores` |
| `livro_id` | uuid | FK para `royalties_livros` |
| `codigo_afiliado` | string | Código único do afiliado |
| `slug` | string | Slug único para URL |
| `comissao_percentual` | number | Percentual de comissão (default: 30) |
| `link_externo` | string | URL externa/landing page |
| `is_active` | boolean | Status ativo |

---

## Alterações

### 1. Criar Componente `AffiliateLinkDialog.tsx`

**Arquivo:** `src/components/royalties/AffiliateLinkDialog.tsx`

Dialog com formulário contendo:

- **Select de Autor**: Lista autores ativos da tabela `royalties_autores`
- **Select de Livro**: Lista livros ativos da tabela `royalties_livros` (filtrado pelo autor selecionado)
- **Campo Comissão**: Input numérico com valor padrão 30%
- **Campo Link Landing Page**: Input de URL para `link_externo`
- **Geração automática**: `slug` e `codigo_afiliado` baseados no autor e livro selecionados

```
+------------------------------------------+
|         Novo Link de Afiliado            |
+------------------------------------------+
| Autor *                                  |
| [Select - Lista de autores ativos]       |
|                                          |
| Livro *                                  |
| [Select - Lista de livros do autor]      |
|                                          |
| Comissão (%) *                           |
| [30___________________________]          |
|                                          |
| Link da Landing Page *                   |
| [https://..._________________]           |
|                                          |
|              [Cancelar] [Cadastrar]      |
+------------------------------------------+
```

### 2. Atualizar Página `Afiliados.tsx`

**Arquivo:** `src/pages/royalties/Afiliados.tsx`

**Alterações:**
1. Importar o novo componente `AffiliateLinkDialog`
2. Adicionar estado `dialogOpen` para controlar o dialog
3. Adicionar botão "Novo Afiliado" ao lado do título
4. Renderizar o dialog

---

## Detalhes Técnicos

### AffiliateLinkDialog.tsx

```typescript
// Campos do formulário
interface FormData {
  autor_id: string;
  livro_id: string;
  comissao_percentual: string;
  link_externo: string;
}

// Geração automática do slug e código
const generateSlugAndCode = (autorNome: string, livroTitulo: string) => {
  const baseSlug = `${livroTitulo}-${autorNome}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  
  const codigo = `${autorNome.split(" ")[0].toUpperCase()}-${Date.now().toString(36)}`;
  
  return { slug: baseSlug, codigo_afiliado: codigo };
};
```

### Lógica de Filtro de Livros

Quando o autor for selecionado, filtrar a lista de livros para mostrar apenas os livros daquele autor.

### Inserção no Banco

```typescript
const payload = {
  autor_id: formData.autor_id,
  livro_id: formData.livro_id,
  comissao_percentual: parseFloat(formData.comissao_percentual),
  link_externo: formData.link_externo.trim(),
  slug: generatedSlug,
  codigo_afiliado: generatedCodigo,
  is_active: true,
};

await supabase.from("royalties_affiliate_links").insert(payload);
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/royalties/AffiliateLinkDialog.tsx` | **Criar** |
| `src/pages/royalties/Afiliados.tsx` | **Modificar** |

---

## Resultado Esperado

1. Botão "Novo Afiliado" visível no topo da página de afiliados
2. Ao clicar, abre um dialog com formulário
3. Selects de autor e livro preenchidos dinamicamente
4. Campo de comissão com valor padrão 30%
5. Ao salvar, o link é criado e aparece na lista
6. Slug e código do afiliado gerados automaticamente
