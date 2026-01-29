
# Plano: Adicionar Busca por SKU no Cadastro de Livros

## Problema Identificado

A busca de produtos no Bling atualmente usa apenas o parâmetro `nome`, ignorando o campo `codigo` (SKU). Por isso, ao buscar "33481", nenhum produto e encontrado.

| Busca atual | Resultado |
|-------------|-----------|
| `?nome=33481` | Nada encontrado |
| Por nome "Biblia" | Funciona |

---

## Solucao Proposta

Modificar a Edge Function para fazer busca em dois campos:

1. Se o termo parece ser numerico → buscar por `codigo` (SKU)
2. Caso contrario → buscar por `nome`
3. Se nao encontrar por codigo, tentar por nome como fallback

---

## Alteracoes Necessarias

### 1. Edge Function `bling-search-product`

Atualizar a funcao `searchProducts` para:

```text
1. Detectar se query e numerica (SKU) ou texto (nome)
2. Se numerica → buscar por codigo primeiro
3. Se nao encontrar → buscar por nome como fallback
4. Se texto → buscar por nome normalmente
```

---

## API do Bling - Parametros Disponiveis

Segundo a documentacao do Bling v3, os parametros de busca sao:
- `nome` - Busca por nome do produto
- `codigo` - Busca por codigo/SKU do produto

---

## Logica de Busca Proposta

```text
query = "33481"
  ↓
[E numerico?] → SIM → Buscar por ?codigo=33481
                       ↓
                 [Encontrou?] → Retornar resultados
                       ↓ NAO
                 Buscar por ?nome=33481 (fallback)

query = "Biblia Estudo"
  ↓
[E numerico?] → NAO → Buscar por ?nome=Biblia%20Estudo
                       ↓
                 Retornar resultados
```

---

## Secao Tecnica

### Arquivo a modificar

`supabase/functions/bling-search-product/index.ts`

### Alteracoes na funcao searchProducts

```typescript
// Funcao auxiliar para detectar se e codigo numerico
function isNumericCode(query: string): boolean {
  return /^\d+$/.test(query.trim());
}

// Buscar produtos - atualizada para suportar codigo
async function searchProducts(accessToken: string, query: string): Promise<any[]> {
  const trimmedQuery = query.trim();
  const encodedQuery = encodeURIComponent(trimmedQuery);
  
  // Se parecer codigo numerico, buscar por codigo primeiro
  if (isNumericCode(trimmedQuery)) {
    const urlByCodigo = `https://www.bling.com.br/Api/v3/produtos?codigo=${encodedQuery}&limite=10`;
    console.log(`Buscando por codigo: ${urlByCodigo}`);
    
    const respCodigo = await fetch(urlByCodigo, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (respCodigo.ok) {
      const json = await respCodigo.json();
      const results = json?.data ?? [];
      if (results.length > 0) {
        return results;
      }
    }
  }
  
  // Buscar por nome (padrao ou fallback)
  const urlByNome = `https://www.bling.com.br/Api/v3/produtos?nome=${encodedQuery}&limite=10`;
  console.log(`Buscando por nome: ${urlByNome}`);
  
  const resp = await fetch(urlByNome, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!resp.ok) {
    console.error('Erro na busca de produtos:', resp.status);
    return [];
  }

  const json = await resp.json();
  return json?.data ?? [];
}
```

---

## Resultado Esperado

Apos a implementacao:

| Busca | Comportamento |
|-------|---------------|
| "33481" | Busca por codigo primeiro → Encontra o produto |
| "Biblia" | Busca por nome → Funciona normalmente |
| "12345abc" | Busca por nome (nao e numerico puro) |

---

## Arquivos Afetados

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/bling-search-product/index.ts` | Adicionar busca por codigo |

Nenhuma alteracao no frontend necessaria - o componente ja mostra "Buscar por titulo ou codigo".
