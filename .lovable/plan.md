

## Plano: Corrigir segmentação de público para usar dados diretos dos pedidos

### Problema
A segmentação atual busca pedidos → extrai `cliente_id` → busca dados em `ebd_clientes`. Porém, **207 de 210 pedidos** de novembro 2025 não têm `cliente_id` preenchido, resultando em apenas 3 destinatários.

Os dados de contato (`customer_name`, `customer_phone`, `customer_email`) já existem diretamente nos pedidos.

### Solução
Alterar `searchAudience()` em `WhatsAppCampaigns.tsx` para:

1. **Canal Shopify**: Buscar `customer_name`, `customer_phone`, `customer_email` diretamente de `ebd_shopify_pedidos`. Se tiver `cliente_id`, enriquecer com dados de `ebd_clientes` (CPF/CNPJ). Se não tiver, usar os dados diretos do pedido e marcar tipo_documento como "indefinido" (incluído em ambos).

2. **Deduplicação por telefone**: Normalizar telefones (remover +55, espaços) antes de deduplicar, para evitar duplicatas por formatação.

3. **Canal Mercado Pago e B2B**: Manter lógica atual (esses canais têm `cliente_id` preenchido), mas adicionar fallback similar.

### Alteração

**Arquivo**: `src/components/admin/WhatsAppCampaigns.tsx`
- Reescrever o bloco Shopify (linhas 131-158) para:
  - Buscar campos `customer_name, customer_phone, customer_email, cliente_id` diretos
  - Para registros com `cliente_id`, buscar CPF/CNPJ de `ebd_clientes`
  - Para registros sem `cliente_id`, usar dados diretos do pedido
  - Deduplicar por telefone normalizado
- Adicionar filtro "Tipo de Documento" = "ambos" para incluir registros sem CPF/CNPJ definido

### Resultado esperado
De ~3 destinatários para ~195 clientes únicos em novembro 2025.

