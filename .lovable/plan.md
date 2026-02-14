

# Correcao do Funil de Vendas

## Problema 1: Numeros nao batem

As etapas 2-4 consultam **todos** os registros da tabela `ebd_clientes`, independente de terem aparecido na etapa "Primeira Compra". Por isso a soma e maior que 518.

**Solucao**: As etapas 2-4 devem filtrar apenas clientes que possuem um pedido pago na `ebd_shopify_pedidos` com primeira compra a partir de 01/01/2026. Isso garante que o funil seja progressivo --- cada etapa e um subconjunto da anterior.

Logica corrigida:
- **Primeira Compra (518)**: Primeiro pedido pago a partir de 01/01/2026
- **Aguardando Login**: Desses 518, quais tem registro em `ebd_clientes` com `ultimo_login IS NULL`
- **Pendente Config**: Desses 518, quais tem `ultimo_login IS NOT NULL` e `onboarding_concluido = false`
- **Ativos**: Desses 518, quais tem `ultimo_login IS NOT NULL`, `onboarding_concluido = true` e login nos ultimos 30 dias
- **Zona de Renovacao**: Desses 518, quais tem `data_proxima_compra` nos proximos 15 dias

Para fazer esse cruzamento, sera criada uma nova RPC no banco que faz JOIN entre `ebd_shopify_pedidos` e `ebd_clientes` (via email ou telefone) para cada etapa.

## Problema 2: Data de corte

Alterar a data de corte de `2025-12-01` para `2026-01-01` em todos os locais:
- RPC `get_primeira_compra_funil_total`
- RPC `get_primeira_compra_funil_list`
- Nova RPC de contagem por etapa

## Alteracoes tecnicas

### Banco de dados
1. Atualizar RPCs `get_primeira_compra_funil_total` e `get_primeira_compra_funil_list` para usar data `2026-01-01`
2. Criar nova RPC `get_funil_stage_counts(p_vendedor_id)` que retorna as contagens das 5 etapas com cruzamento entre pedidos e clientes, garantindo que cada etapa seja subconjunto da "Primeira Compra"

### Arquivo: `src/pages/vendedor/VendedorFunil.tsx`
1. Substituir as 5 queries separadas por uma unica chamada a nova RPC
2. Ajustar as queries de lista expandida para tambem filtrar apenas clientes com primeira compra a partir de 01/01/2026

