

# Correção: PDV Balcão com Desconto Por Categoria do Cliente

## Problema Identificado

O PDV Balcão atual está aplicando um **desconto fixo de 30%** para todos os produtos:

```typescript
const DESCONTO_REPRESENTANTE = 0.30; // ERRADO - fixo 30%
```

Mas o correto é usar os **descontos por categoria cadastrados no card do cliente**, como mostrado nas imagens:
- Cliente "IGREJA EVANGELICA MINISTERIO APOSTOLICO PALAVRA E UNÇAO": 30% em todas as categorias
- Cliente "ADVEC SARACURUNA": 40% em todas as categorias

## Como Funciona o Sistema de Descontos

### Estrutura do Banco
- Tabela: `ebd_descontos_categoria_representante`
- Campos: `cliente_id`, `categoria`, `percentual_desconto`
- Categorias: `revistas`, `biblias`, `livros`, `infantil`, `perfumes`, `outros`

### Lógica Existente (já implementada)
O sistema já possui toda a infraestrutura para calcular descontos por categoria:

| Arquivo | Função |
|---------|--------|
| `useDescontosRepresentante.tsx` | Busca descontos por categoria do cliente |
| `categoriasShopify.ts` | Categoriza produto pelo título |
| `descontosCalculadora.ts` | Calcula desconto por categoria para produtos locais |

## Modificações Necessárias

### Arquivo: `src/pages/vendedor/VendedorPDV.tsx`

#### 1. Adicionar seleção de cliente cadastrado

Antes de adicionar produtos, o vendedor precisa **selecionar ou buscar um cliente cadastrado** para que o sistema saiba quais descontos aplicar.

```typescript
// Novo estado para cliente selecionado
const [clienteSelecionado, setClienteSelecionado] = useState<ClienteEBD | null>(null);
```

#### 2. Buscar descontos por categoria do cliente

Usar o hook existente `useDescontosRepresentante`:

```typescript
const { data: descontosPorCategoria } = useDescontosRepresentante(clienteSelecionado?.id || null);
```

#### 3. Calcular desconto por item baseado na categoria

Usar a função `categorizarProduto` para determinar a categoria de cada produto:

```typescript
import { categorizarProduto } from "@/constants/categoriasShopify";

// Para cada item no carrinho:
const categoria = categorizarProduto(item.produto.titulo);
const percentualDesconto = descontosPorCategoria?.[categoria] || 0;
const precoComDesconto = item.produto.preco_cheio * (1 - percentualDesconto / 100);
```

#### 4. Exibir desconto específico por item

Mostrar no carrinho o percentual de desconto de cada categoria:

```text
+------------------------------------------+
| Revista Adultos - Lição 1                |
| Categoria: Revistas EBD                  |
| R$ 45,00 → R$ 31,50 (-30%)               |
+------------------------------------------+
| Bíblia Sagrada NVI                       |
| Categoria: Bíblias                       |
| R$ 89,90 → R$ 53,94 (-40%)               |
+------------------------------------------+
```

#### 5. Enviar descontos corretos ao Bling

Cada item será enviado com seu percentual específico:

```typescript
itens: carrinho.map(item => {
  const categoria = categorizarProduto(item.produto.titulo);
  const descontoItem = descontosPorCategoria?.[categoria] || 0;
  
  return {
    bling_produto_id: item.produto.bling_produto_id,
    titulo: item.produto.titulo,
    quantidade: item.quantidade,
    preco_cheio: item.produto.preco_cheio,
    valor: item.produto.preco_cheio * (1 - descontoItem / 100),
    descontoItem: descontoItem, // 30% ou 40% conforme categoria
  };
}),
```

## Fluxo Corrigido

```text
1. Vendedora Gloria abre PDV Balcão
2. BUSCA/SELECIONA o cliente "IGREJA EVANGELICA MINISTERIO APOSTOLICO..."
3. Sistema carrega descontos cadastrados: 30% para todas as categorias
4. Adiciona produtos ao carrinho
5. Sistema categoriza cada produto e aplica desconto correspondente:
   - "Revista Adultos" → categoria "revistas" → 30% off
   - "Bíblia NVI" → categoria "biblias" → 30% off
6. Finaliza venda
7. Sistema envia ao Bling com descontos POR ITEM
8. NF-e é emitida com valores corretos
```

## Caso de Uso: Cliente ADVEC SARACURUNA

Se o cliente tiver 40% cadastrado:
- Subtotal: R$ 760,78
- Desconto (40%): -R$ 304,31
- **Total: R$ 456,47**

## Interface Proposta

```text
+------------------------------------------+
| PDV Balcão - Polo Penha                  |
+------------------------------------------+
| 👤 Cliente: [Buscar cliente...]          |
|    ADVEC SARACURUNA                      |
|    Descontos: 40% todas categorias       |
+------------------------------------------+
| 🛒 Carrinho                              |
| +--------------------------------------+ |
| | Revista Adultos                      | |
| | Revistas EBD • -40%                  | |
| | R$ 45,00 → R$ 27,00                  | |
| +--------------------------------------+ |
| | Bíblia NVI                           | |
| | Bíblias • -40%                       | |
| | R$ 89,90 → R$ 53,94                  | |
| +--------------------------------------+ |
+------------------------------------------+
| Subtotal:        R$ 134,90              |
| Desconto (40%): -R$ 53,96               |
| TOTAL:           R$ 80,94               |
+------------------------------------------+
```

## Resultado Esperado

- Cada cliente terá seu desconto específico por categoria aplicado
- NF-es serão emitidas com valores corretos
- Sistema flexível: clientes podem ter % diferentes por categoria
- Compatível com clientes ADVEC (40%), Igrejas (30%), etc.

