

# Plano: Permitir Vincular Livro Existente ao Bling

## Problema Identificado

O livro "O Cativeiro Babilônico" foi cadastrado **manualmente** (sem usar a busca do Bling), por isso o campo `bling_produto_id` está vazio (`null`). A sincronização de vendas do Bling só funciona para livros que possuem este campo preenchido.

Atualmente:
- A busca do Bling só aparece ao **criar** um novo livro (`{!livro && ...}`)
- Não há opção de vincular um livro existente ao produto do Bling

## Solução

Modificar o formulário de edição de livros para permitir buscar e vincular o produto do Bling mesmo em livros já cadastrados.

---

## Alterações

### 1. Atualizar `LivroDialog.tsx`

Remover a restrição que esconde a busca do Bling ao editar:

**Antes:**
```tsx
{!livro && (
  <BlingProductSearch
    onSelect={handleBlingProductSelect}
    disabled={loading}
  />
)}
```

**Depois:**
```tsx
<BlingProductSearch
  onSelect={handleBlingProductSelect}
  disabled={loading}
  currentBlingId={formData.bling_produto_id}
/>
```

### 2. Melhorar `BlingProductSearch.tsx`

Adicionar indicador visual quando o livro já está vinculado ao Bling:

- Mostrar o ID do produto Bling atual (se existir)
- Permitir trocar o vínculo
- Manter a funcionalidade de busca

### 3. Exibir status de vinculação na lista de livros

Na página de livros (`/royalties/livros`), adicionar um indicador visual mostrando se o livro está vinculado ao Bling ou não:

- Badge verde: "Vinculado ao Bling"
- Badge amarelo: "Sem vínculo" (não sincroniza vendas)

---

## Fluxo do Usuário

1. Acessar `/royalties/livros`
2. Clicar no livro "O Cativeiro Babilônico" para editar
3. Na seção "Importar do Bling", buscar por "33476" ou pelo título
4. Selecionar o produto correto
5. Salvar - o `bling_produto_id` será preenchido
6. Ir para `/royalties/vendas` e clicar em "Sincronizar com Bling"
7. As vendas serão importadas automaticamente

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/royalties/LivroDialog.tsx` | Mostrar BlingProductSearch também ao editar |
| `src/components/royalties/BlingProductSearch.tsx` | Adicionar prop para mostrar vínculo atual |
| `src/pages/royalties/Livros.tsx` | Adicionar indicador de vínculo na tabela |

---

## Seção Técnica

### Mudança no LivroDialog.tsx

```typescript
// Linha ~221-227 - Remover condicional !livro
<BlingProductSearch
  onSelect={handleBlingProductSelect}
  disabled={loading}
  currentBlingId={formData.bling_produto_id}
/>
```

### Nova prop no BlingProductSearch

```typescript
interface BlingProductSearchProps {
  onSelect: (product: BlingProduct) => void;
  disabled?: boolean;
  currentBlingId?: number | null; // NOVO: ID atual vinculado
}
```

### Indicador visual no componente

Se `currentBlingId` estiver preenchido, mostrar:
```tsx
{currentBlingId && (
  <div className="text-xs text-green-600 flex items-center gap-1">
    <Check className="h-3 w-3" />
    Vinculado ao Bling (ID: {currentBlingId})
  </div>
)}
```

### Badge na lista de livros

```tsx
{livro.bling_produto_id ? (
  <Badge variant="outline" className="bg-green-50 text-green-700">
    <Link2 className="h-3 w-3 mr-1" />
    Bling
  </Badge>
) : (
  <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
    <Unlink className="h-3 w-3 mr-1" />
    Sem vínculo
  </Badge>
)}
```

---

## Resultado Esperado

Após as alterações:
1. O usuário poderá editar o livro "O Cativeiro Babilônico"
2. Buscar pelo SKU 33476 no Bling
3. Vincular o produto
4. As vendas futuras e passadas serão sincronizadas corretamente

