## Objetivo

Gerar um único arquivo CSV em `/mnt/documents/clientes_todos_canais.csv` contendo **nome completo, telefone e email** de todos os clientes que já compraram em qualquer canal, **excluindo números com DDI internacional** (Portugal +351, EUA +1, etc.).

## Fontes de dados (canais)

| Tabela | Canal | Campos usados |
|---|---|---|
| `ebd_shopify_pedidos` | Shopify EBD (histórico) | customer_name, customer_email, customer_phone |
| `ebd_shopify_pedidos_cg` | Shopify Central Gospel (histórico) | customer_name, customer_email, customer_phone |
| `ebd_loja_pedidos_cg` | Loja Atual CG | customer_name, customer_email, customer_phone (fallback endereco_*) |
| `bling_marketplace_pedidos` | Amazon / Mercado Livre / Shopee | customer_name, customer_email (sem telefone — join com `ebd_clientes` por documento quando possível) |
| `ebd_pedidos` | EBD direto (MP) | nome_cliente + sobrenome_cliente, email_cliente, telefone_cliente |
| `vendas_balcao` | Balcão | cliente_nome, email, telefone |
| `royalties_vendas` | Royalties / Autor | cliente_nome, (email/telefone se existirem) |
| `ebd_clientes` | Cadastro de clientes (enriquecimento) | nome_*, email_*, telefone |

## Regra de filtragem (somente Brasil)

Normalizar telefone removendo `+`, espaços, parênteses, hífens. Então classificar:

- **Manter**: 10 ou 11 dígitos (BR sem DDI) **OU** 12-13 dígitos começando com `55` (BR com DDI).
- **Descartar**: qualquer outro DDI (`1` EUA/Canadá, `351` Portugal, `44` UK, `34` Espanha, etc.).
- Registros **sem telefone válido BR** são descartados (mesmo que tenham email), conforme a instrução de excluir DDI internacionais.

Telefone final normalizado para 11 dígitos (DDD + número), sem `+55`.

## Deduplicação

Chave: telefone normalizado. Em caso de duplicata, manter o registro com nome mais completo e email não-nulo (preferência: canais que têm nome+email+telefone).

## Saída

CSV UTF-8 com cabeçalho:
```
nome_completo,telefone,email,canais
```
- `canais`: lista separada por `;` dos canais onde o cliente aparece (útil para auditoria).

## Execução

Script Python único usando `psql` (env `PGHOST` já disponível) para extrair cada canal, normalizar/dedup em memória (pandas) e escrever o CSV.

## Confirmações antes de executar

1. **Bling marketplace (Amazon/ML/Shopee) não tem telefone** nos pedidos. Devo: (a) incluir somente quando conseguir telefone via `ebd_clientes` por CPF/CNPJ, ou (b) ignorar esses pedidos por completo? — proponho **(a)**.
2. **`ebd_clientes` (cadastro puro, sem pedido)**: incluo apenas clientes que **fizeram compra** em algum canal, conforme pedido. Cadastros órfãos ficam de fora.

Posso prosseguir com essas regras?
