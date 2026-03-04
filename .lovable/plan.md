

## Problema: Classificação incorreta no "Vendas de Hoje"

O "Vendas de Hoje" rotula **todos** os pedidos de `ebd_shopify_pedidos` como "B2B", mas essa tabela contém pedidos de diversos canais (Igreja CNPJ, Igreja CPF, ADVECS, Pessoa Física, Revendedores, etc.). "Ariel Alves" é uma venda e-commerce (aparece em `ebd_shopify_pedidos_cg`), mas como também está em `ebd_shopify_pedidos`, aparece duplicada e rotulada como "B2B".

### Solução

**Arquivo: `src/pages/admin/ComissaoAlfaMarketing.tsx`** — Reescrever a seção "Vendas de Hoje" (linhas 149-239):

1. **Para `ebd_shopify_pedidos`**: Fazer join com `ebd_clientes` (via `customer_email`) para obter `tipo_cliente` e classificar corretamente cada pedido no canal real (Igreja CNPJ, Igreja CPF, ADVECS, Pessoa Física, Revendedor, Representante, Lojista). Pedidos sem match em `ebd_clientes` ficam como "B2B".

2. **Evitar duplicatas com CG**: Filtrar pedidos de `ebd_shopify_pedidos` que já existem em `ebd_shopify_pedidos_cg` (mesmos cliente+valor no mesmo dia), ou alternativamente, excluir os que têm prefixo "BLING-" (shadow records).

3. **Lógica de classificação por `tipo_cliente`**:
   - Contém "ADVEC" → canal "ADVECS"
   - Contém "IGREJA" + "CNPJ" → canal "Igreja CNPJ"
   - Contém "IGREJA" + "CPF" → canal "Igreja CPF"
   - Contém "LOJISTA" → canal "Lojistas"
   - Contém "PESSOA" ou "FISICA" → canal "Pessoa Física"
   - Contém "REVENDEDOR" → canal "Revendedores"
   - Contém "REPRESENTANTE" → canal "Representantes"
   - Outros → "B2B"

4. **Propostas (`vendedor_propostas`)**: Classificar também por `tipo_cliente` do cliente em `ebd_clientes` em vez de rotular tudo como "Proposta B2B".

