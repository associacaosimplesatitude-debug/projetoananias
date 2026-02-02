
# Plano de Implementacao: Melhorias no Portal do Autor

## Visao Geral

Este plano aborda 3 melhorias solicitadas para o Portal do Autor:

1. **Menu Contratos**: Exibir contratos do autor com PDF e datas de vigencia visiveis
2. **Comprovantes de Pagamento**: Adicionar upload de comprovante nos pagamentos do admin e exibir para o autor
3. **Loja com Produtos Shopify**: Refatorar a loja do autor para usar produtos reais do Shopify com descontos por categoria

---

## 1. Menu Contratos no Portal do Autor

### Objetivo
Criar uma pagina onde o autor possa visualizar seus contratos registrados no sistema, incluindo:
- Visualizacao/download do PDF
- Datas de inicio e termino bem visiveis
- Status do contrato (Vigente, Expirado, Futuro)

### Arquivo a Criar
`src/pages/autor/Contratos.tsx`

### Estrutura da Pagina
```text
+------------------------------------------+
|   MEU CONTRATO                           |
+------------------------------------------+
| [Vigente] Contrato do Livro XYZ          |
|                                          |
| Inicio: 01/01/2024     Termino: 31/12/2026|
|                                          |
| [Botao: Ver PDF]                         |
+------------------------------------------+
```

### Dados Utilizados
- Tabela: `royalties_contratos`
- Filtro: `autor_id = autor logado`
- Bucket: `royalties-contratos` (ja existe)

### Modificacoes Necessarias
| Arquivo | Acao |
|---------|------|
| `src/pages/autor/Contratos.tsx` | Criar nova pagina |
| `src/components/royalties/AutorLayout.tsx` | Adicionar menu "Contrato" |
| `src/App.tsx` | Adicionar rota `/autor/contrato` |

---

## 2. Comprovantes de Pagamento

### Situacao Atual
- O campo `comprovante_url` ja existe na tabela `royalties_pagamentos`
- O bucket `royalties-comprovantes` ja existe
- O componente `ComprovanteUpload` ja existe e funciona
- A pagina `MeusPagamentos.tsx` do autor ja exibe o comprovante em modo `readOnly`
- A pagina `Pagamentos.tsx` do admin ja tem o upload de comprovante

O sistema de comprovantes ja esta implementado. Nenhuma alteracao e necessaria.

---

## 3. Loja com Produtos Shopify

### Objetivo
Refatorar a loja do autor (`/autor/loja`) para:
- Buscar produtos reais da Shopify (igual VendedorShopify)
- Aplicar descontos por categoria configurados no cadastro do autor
- Mostrar descontos no carrinho
- Manter o fluxo de resgate usando saldo de royalties

### Logica de Desconto (Hierarquia)
1. **Livro do proprio autor**: Usar `desconto_livros_proprios` (ex: 55%)
2. **Outros produtos**: Usar desconto por categoria em `royalties_descontos_categoria_autor`

### Categorias Suportadas
- `revistas` - Revistas EBD
- `biblias` - Biblias
- `livros` - Livros e Devocionais
- `infantil` - Infantil
- `perfumes` - Perfumes
- `outros` - Outros Produtos

### Modificacoes Necessarias

| Arquivo | Acao |
|---------|------|
| `src/pages/autor/Loja.tsx` | Refatorar completamente |

### Nova Estrutura da Loja

```text
+------------------------------------------+
| LOJA - Trocar Royalties por Produtos     |
+------------------------------------------+
| Saldo Disponivel: R$ 1.250,00            |
+------------------------------------------+
| [Busca]    [Filtro Categoria v]          |
+------------------------------------------+
|                                          |
| [Grid de Produtos Shopify]               |
| - Imagem                                 |
| - Titulo                                 |
| - Preco Original / Preco com Desconto    |
| - Badge: -40% OFF (Biblias)              |
| - Botao: Adicionar                       |
|                                          |
+------------------------------------------+
| CARRINHO (Sheet lateral)                 |
| - Item 1: R$ 50,00 -> R$ 30,00 (-40%)    |
| - Item 2: R$ 80,00 -> R$ 36,00 (-55%)    |
|   (Seu Livro)                            |
| ---------------------------------------- |
| Total: R$ 66,00                          |
| Saldo: R$ 1.250,00 (verde)               |
| [Confirmar Resgate]                      |
+------------------------------------------+
```

### Fluxo de Dados

1. **Buscar produtos**: `fetchShopifyProducts()` da lib/shopify.ts
2. **Buscar descontos do autor**: Query em `royalties_descontos_categoria_autor`
3. **Identificar livros do autor**: Comparar titulo do produto Shopify com livros em `royalties_livros`
4. **Calcular desconto**: Hierarquia livro proprio > categoria
5. **Criar resgate**: Inserir em `royalties_resgates` com itens

### Identificacao de Livros do Autor
Para saber se um produto Shopify e livro do autor, precisamos comparar:
- Titulo do produto Shopify com `titulo` em `royalties_livros` do autor

---

## Resumo das Entregas

| Feature | Arquivos | Complexidade |
|---------|----------|--------------|
| Menu Contratos | 3 arquivos (1 novo, 2 modificados) | Baixa |
| Comprovantes | Ja implementado | N/A |
| Loja Shopify | 1 arquivo (refatorar) | Media |

## Detalhes Tecnicos

### Dependencias Utilizadas
- `@tanstack/react-query` - Gerenciamento de queries
- `lucide-react` - Icones
- `date-fns` - Formatacao de datas
- Componentes shadcn/ui existentes

### Integracao com Shopify
A loja do autor usara a mesma integracao Shopify ja existente:
- `fetchShopifyProducts()` de `src/lib/shopify.ts`
- Edge function `shopify-storefront-products` (ja implementada)

### Calculo de Desconto por Categoria
Reutilizar a logica de `categorizarProduto()` de `src/constants/categoriasShopify.ts` para determinar a categoria de cada produto e buscar o percentual correspondente na tabela `royalties_descontos_categoria_autor`.
