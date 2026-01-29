

# Plano: Integração Bling no Catálogo de Livros (Royalties)

## Resumo

Adicionar funcionalidade de busca automática no Bling ao cadastrar/editar livros no módulo de Royalties. O usuário poderá buscar um produto pelo nome ou código, e o sistema preencherá automaticamente os campos do formulário com os dados do Bling.

---

## Fluxo de Uso

```text
+-------------------------------------------------------+
|                 NOVO LIVRO (Dialog)                   |
+-------------------------------------------------------+
|                                                       |
|  [🔍 Buscar no Bling: ___________________] [Buscar]   |
|                                                       |
|  ┌─────────────────────────────────────────────────┐  |
|  │ Resultados do Bling (se houver):                │  |
|  │ ┌─────────────────────────────────────────────┐ │  |
|  │ │ 📗 Livro A - Cód: 123 - R$ 45,00 [Selecionar]│ │  |
|  │ │ 📗 Livro B - Cód: 456 - R$ 52,00 [Selecionar]│ │  |
|  │ └─────────────────────────────────────────────┘ │  |
|  └─────────────────────────────────────────────────┘  |
|                                                       |
|  [Capa]   Título: [__________________]                |
|           Autor:  [Selecionar autor ▼]                |
|                                                       |
|  Valor de Capa (R$): [_________]                      |
|  Descrição: [____________________]                    |
|                                                       |
+-------------------------------------------------------+
```

---

## Componentes

### 1. Edge Function: `bling-search-product`

Criar nova edge function para buscar produtos no Bling:

**Endpoint:** `POST /functions/v1/bling-search-product`

**Payload:**
```json
{
  "query": "Nome do livro ou código"
}
```

**Resposta:**
```json
{
  "success": true,
  "products": [
    {
      "id": 123456,
      "codigo": "LIV-001",
      "nome": "O Caminho da Fé",
      "preco": 45.90,
      "imagemURL": "https://...",
      "descricao": "Descrição do livro",
      "estoque": 50
    }
  ]
}
```

**Lógica:**
1. Receber termo de busca
2. Autenticar com Bling (usar `bling_config`)
3. Chamar `GET /Api/v3/produtos?nome={query}&limite=10`
4. Para cada produto encontrado, buscar detalhes com `GET /Api/v3/produtos/{id}`
5. Retornar lista formatada

---

### 2. Componente: `BlingProductSearch`

Novo componente para busca e seleção de produtos:

**Props:**
```typescript
interface BlingProductSearchProps {
  onSelect: (product: BlingProduct) => void;
  disabled?: boolean;
}
```

**Funcionalidades:**
- Input de busca com debounce (500ms)
- Exibição de resultados em lista
- Loading state durante busca
- Botão "Selecionar" em cada item
- Mensagem quando não encontrar resultados

---

### 3. Atualização: `LivroDialog.tsx`

Modificar o dialog de cadastro/edição de livros:

**Alterações:**
1. Adicionar componente `BlingProductSearch` no topo do formulário
2. Ao selecionar produto do Bling:
   - Preencher `titulo` com `produto.nome`
   - Preencher `valor_capa` com `produto.preco`
   - Preencher `capa_url` com `produto.imagemURL`
   - Preencher `descricao` com `produto.descricao` (limpo de HTML)
3. Armazenar `bling_produto_id` para referência futura

---

### 4. Migração: Adicionar campo `bling_produto_id`

Adicionar coluna opcional na tabela `royalties_livros`:

```sql
ALTER TABLE royalties_livros
ADD COLUMN bling_produto_id BIGINT DEFAULT NULL;

-- Índice para buscas
CREATE INDEX idx_royalties_livros_bling_id 
ON royalties_livros(bling_produto_id);

-- Comentário
COMMENT ON COLUMN royalties_livros.bling_produto_id 
IS 'ID do produto correspondente no Bling ERP';
```

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/bling-search-product/index.ts` | Edge function para buscar produtos no Bling |
| `src/components/royalties/BlingProductSearch.tsx` | Componente de busca e seleção |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/royalties/LivroDialog.tsx` | Integrar componente de busca Bling |
| `supabase/config.toml` | Registrar nova edge function |

---

## Estrutura da Edge Function

```text
bling-search-product/
└── index.ts
    ├── corsHeaders
    ├── refreshBlingToken() - Renovar token se expirado
    ├── isTokenExpired() - Verificar expiração
    ├── stripHtmlTags() - Limpar descrição HTML
    ├── searchProducts() - Buscar produtos na API
    └── serve() - Handler principal
```

---

## UI do Componente BlingProductSearch

```text
┌─────────────────────────────────────────────────────────┐
│ Importar do Bling                                       │
├─────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────┐ ┌──────────┐        │
│ │ Buscar por título ou código... │ │ 🔍 Buscar │        │
│ └────────────────────────────────┘ └──────────┘        │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐│
│ │ 📖 O Caminho da Fé                                  ││
│ │    Código: LIV-001 | R$ 45,90                       ││
│ │    Estoque: 50 unidades              [Selecionar]   ││
│ ├─────────────────────────────────────────────────────┤│
│ │ 📖 Jornada de Fé                                    ││
│ │    Código: LIV-002 | R$ 38,50                       ││
│ │    Estoque: 32 unidades              [Selecionar]   ││
│ └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Seção Técnica

### API Bling v3 - Endpoints Utilizados

1. **Listar/Buscar Produtos:**
   ```
   GET /Api/v3/produtos?nome={termo}&limite=10
   ```
   Retorna lista básica com: id, nome, preco, imagemURL

2. **Detalhes do Produto:**
   ```
   GET /Api/v3/produtos/{id}
   ```
   Retorna dados completos: descricaoCurta, pesoBruto, estoque, etc.

### Rate Limiting

O Bling permite 3 requisições/segundo. A edge function incluirá:
- Delay de 350ms entre chamadas
- Retry automático em caso de 429 (Too Many Requests)
- Limite de 10 produtos por busca

### Estrutura de Resposta do Bling (Produto)

```json
{
  "data": {
    "id": 123456,
    "nome": "Nome do Produto",
    "codigo": "SKU-001",
    "preco": 45.90,
    "imagemURL": "https://...",
    "descricaoCurta": "<p>Descrição com HTML</p>",
    "tipo": "P",
    "pesoBruto": 0.5
  }
}
```

### Campos Mapeados

| Bling | Royalties Livros |
|-------|------------------|
| `id` | `bling_produto_id` |
| `nome` | `titulo` |
| `preco` | `valor_capa` |
| `imagemURL` | `capa_url` |
| `descricaoCurta` | `descricao` (limpo de HTML) |

---

## Sequência de Implementação

1. **Database:** Adicionar coluna `bling_produto_id` na tabela `royalties_livros`
2. **Edge Function:** Criar `bling-search-product` com busca e detalhamento
3. **Componente:** Criar `BlingProductSearch.tsx` com interface de busca
4. **Integração:** Atualizar `LivroDialog.tsx` para usar o componente
5. **Deploy:** Registrar função no `config.toml`

