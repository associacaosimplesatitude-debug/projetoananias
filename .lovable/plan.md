

## Problemas Identificados

1. **Canal "B2B" sem vendedor**: Quando `ebd_shopify_pedidos` tem `cliente_id = null` e `vendedor_id = null`, o sistema não consegue classificar o canal nem o vendedor. Precisa fazer fallback buscando o cliente pelo `customer_email` na tabela `ebd_clientes` para resolver tanto o `tipo_cliente` (canal correto) quanto o `vendedor_id` (nome do vendedor).

2. **Ordenação**: Não há campo de horário sendo buscado nem ordenação — os pedidos aparecem na ordem em que são processados, não por horário. Precisa incluir `created_at` e ordenar do mais recente para o mais antigo.

---

## Solução

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`**

### 1. Adicionar `hora` à interface `VendaHoje`
- Novo campo `hora: string` para armazenar o timestamp e permitir ordenação.

### 2. Buscar `created_at` em todas as queries de vendas
- Adicionar `created_at` ao select de cada tabela (Shopify, MP, CG, Propostas, PDV, Marketplaces).

### 3. Criar mapa de clientes por email
- Além do `clienteMap` por ID, criar um `clienteEmailMap` indexado por `email_superintendente` (lowercase/trim).
- Quando `cliente_id` é null no Shopify, buscar pelo `customer_email` no `clienteEmailMap` para obter `tipo_cliente` e `vendedor_id`.

### 4. Resolver vendedor via cliente
- Se `vendedor_id` do pedido é null mas o cliente em `ebd_clientes` tem `vendedor_id`, usar esse vendedor do mapa.

### 5. Ordenar por hora (mais recente primeiro)
- Após agregar todas as vendas, fazer `vendas.sort()` por `hora` descendente.

### 6. Exibir hora na tabela
- Adicionar coluna "Hora" na tabela de Vendas de Hoje mostrando apenas HH:mm.

