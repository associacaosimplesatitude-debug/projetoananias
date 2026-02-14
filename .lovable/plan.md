

# Filtrar Funil "Primeira Compra" a partir de Dez/2025 + Mostrar Valor e Data

## O que muda

### 1. Filtro de data (a partir de 01/12/2025)
Tanto na contagem dos cards quanto na listagem expandida, a etapa "Primeira Compra" passara a filtrar apenas registros de `ebd_pos_venda_ecommerce` cujo pedido associado (`ebd_shopify_pedidos`) tenha `created_at >= '2025-12-01'`.

### 2. Exibir valor e data na lista
Quando o usuario expandir o card "Primeira Compra", cada cliente mostrara:
- Nome da igreja
- Telefone
- **Valor da compra** (ex: R$ 171,11)
- **Data do pedido** (ex: 23/12/2025)
- Status WhatsApp

### 3. Arquivo unico a editar
`src/pages/vendedor/VendedorFunil.tsx`

---

## Detalhes tecnicos

### Interface `ClienteItem`
Adicionar dois campos opcionais:
- `valor_compra?: number`
- `data_compra?: string`

### Query de contagem (card)
Adicionar filtro de data no JOIN com pedidos:

```text
// Buscar pedido_ids de pedidos a partir de 01/12/2025
// Depois contar apenas os registros de pos_venda cujo pedido_id esta nessa lista
```

Como a tabela `ebd_pos_venda_ecommerce` nao tem a data do pedido diretamente, a contagem precisara de uma abordagem em dois passos:
1. Buscar IDs de pedidos com `created_at >= '2025-12-01'` em `ebd_shopify_pedidos`
2. Contar registros em `ebd_pos_venda_ecommerce` onde `pedido_id` esta nessa lista e `status = 'pendente'`

### Query de listagem expandida
Para a etapa `compra_aprovada`:
1. Buscar de `ebd_pos_venda_ecommerce` (status=pendente) com seus `pedido_id` e `cliente_id`
2. Buscar de `ebd_shopify_pedidos` pelos `pedido_id` para obter `valor_total` e `created_at`, filtrando `created_at >= '2025-12-01'`
3. Cruzar os resultados: so manter clientes cujo pedido e de dez/2025 em diante
4. Buscar dados do cliente em `ebd_clientes`

### Renderizacao
Na lista expandida, quando `valor_compra` e `data_compra` existirem, exibir ao lado do nome:

```text
Igreja Exemplo          R$ 294,36    28/12/2025    [Entregue]
  51999999999
```

Valor formatado com `toLocaleString('pt-BR')` e data com `toLocaleDateString('pt-BR')`.
