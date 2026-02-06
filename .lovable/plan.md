
# Auditoria Completa: Edge Functions - Status de Deploy

## Resumo Executivo

Testei todas as **91 Edge Functions** do projeto. O resultado mostra que a maioria está **sem deploy** (404).

## Status por Categoria

### ✅ FUNÇÕES ATIVAS (Funcionando)

| Função | Status | Resposta |
|--------|--------|----------|
| `aprovar-faturamento` | ✅ Ativo | Valida parâmetros corretamente |
| `calculate-shipping` | ✅ Ativo | Valida CEP obrigatório |
| `bling-create-order` | ✅ Ativo | Processa pedidos |
| `mercadopago-webhook` | ✅ Ativo | Webhook funcionando |
| `mp-sync-pending-payments` | ✅ Ativo | Sync funcionando |
| `send-order-email` | ✅ Ativo | Envia emails |
| `send-welcome-email` | ✅ Ativo | Envia emails |

### ❌ FUNÇÕES SEM DEPLOY (404) - 84 funções

#### Lote 1: Sincronização de Pedidos (CRÍTICO)
- `ebd-shopify-sync-orders` - Sincronização de pedidos Shopify
- `ebd-shopify-backfill-items` - Backfill de itens
- `cg-shopify-sync-orders` - Sync Central Gospel
- `ebd-shopify-order-create` - Webhook de criação
- `ebd-shopify-order-webhook` - Webhook de pedidos
- `ebd-shopify-sync-order-items` - Sync de itens
- `mp-checkout-init` - Inicialização checkout MP

#### Lote 2: Integração Bling (CRÍTICO)
- `bling-sync-order-status` - Status de pedidos
- `bling-sync-shopify-orders` - Sync Shopify-Bling
- `bling-generate-nfe` - Geração de NF-e
- `bling-check-nfe-status` - Status de NF-e
- `bling-get-order-details` - Detalhes de pedidos
- `bling-advec-total` - Totais ADVEC
- `bling-backfill-documents` - Backfill documentos
- `bling-callback` / `bling-callback-pe` / `bling-callback-penha`
- `bling-check-stock` - Verificação de estoque
- `bling-count-sku-sales` - Contagem de vendas
- `bling-find-order-id` - Busca de pedidos
- `bling-get-nfe-by-order-id` - NF-e por pedido
- `bling-import-nfe-penha` - Import NF-e Penha
- `bling-link-orders` - Link de pedidos
- `bling-list-empresas` - Lista empresas
- `bling-list-my-orders` - Lista pedidos
- `bling-refresh-token` - Refresh token OAuth
- `bling-search-client` - Busca clientes
- `bling-search-product` - Busca produtos
- `bling-sync-marketplace-orders` - Sync marketplaces
- `bling-sync-products` - Sync produtos
- `bling-sync-royalties-sales` - Sync royalties
- `bling-test-nfe-penha` - Teste NF-e
- `bling-update-order` - Atualização de pedidos

#### Lote 3: Comissões e NF-e
- `sync-comissoes-nfe` - Sync comissões NF
- `sync-nf-danfe-batch` - Sync DANFE
- `sync-comissoes-completo` - Sync completo
- `sync-comissoes-faturado` - Sync faturados
- `sync-royalties-nfe-links` - Links royalties
- `backfill-comissoes-hierarquicas` - Backfill hierárquicas
- `backfill-parcelas` - Backfill parcelas
- `backfill-bling-order-ids` - Backfill IDs Bling
- `update-comissao-status` - Atualização status
- `update-parcelas-status` - Atualização parcelas
- `fix-comissoes-shopify-link` - Fix links

#### Lote 4: Resgates e Aprovações
- `aprovar-resgate` - Aprovação de resgates

#### Lote 5: Criação de Usuários
- `create-admin-user` - Admin
- `create-aluno-public` - Aluno público
- `create-aluno-user` - Aluno
- `create-auth-user-direct` - Auth direto
- `create-autor-user` - Autor
- `create-ebd-user` - Usuário EBD
- `create-mercadopago-payment` - Pagamento MP
- `create-professor-user` - Professor
- `delete-user` - Deletar usuário
- `update-user-password` - Atualizar senha
- `update-user-password-by-email` - Senha por email

#### Lote 6: Webhooks e Emails
- `ebd-brevo-webhook` - Webhook Brevo
- `ebd-brevo-webhook-public` - Webhook público
- `ebd-brevo-webhook-teste` - Webhook teste
- `send-royalties-email` - Email royalties

#### Lote 7: Mercado Pago
- `mp-backfill-comissoes` - Backfill comissões
- `mp-sync-orphan-order` - Sync órfãos
- `mp-sync-payment-status` - Sync status

#### Lote 8: EBD e Onboarding
- `ebd-backfill-pos-venda` - Backfill pós-venda
- `ebd-create-lead-accounts` - Criar leads
- `ebd-instant-signup` - Cadastro instantâneo
- `ebd-link-orphan-shopify-orders` - Link órfãos
- `ebd-send-activation-batch` - Batch ativação
- `ebd-test-email-open` - Teste abertura

#### Lote 9: Shopify
- `shopify-debug-order-structure` - Debug
- `shopify-orders-webhook` - Webhook
- `shopify-register-webhook` - Registro
- `shopify-sync-order-status` - Sync status
- `shopify-storefront-products` (precisa recheck)
- `shopify-storefront-checkout` (precisa recheck)

#### Lote 10: Importações
- `import-atacado-csv` - CSV atacado
- `import-mercadolivre-csv` - CSV ML
- `import-shopee-csv` - CSV Shopee

#### Lote 11: Outros
- `apresentacao-ai-assistant` - Assistente IA
- `fetch-bible-verse` - Versículos
- `gemini-assistente-gestao` - Gemini
- `generate-recurring-bills` - Contas recorrentes
- `track-affiliate-click` - Tracking
- `process-transparent-payment` - Pagamento transparente

## Solução Proposta

### Deploy em lotes organizados por prioridade:

**Prioridade 1 - Core Business (16 funções)**
Sincronização, checkout, aprovações

**Prioridade 2 - Integração Bling (20 funções)**
Todas as funções de integração com Bling

**Prioridade 3 - Usuários e Auth (11 funções)**
Criação e gerenciamento de usuários

**Prioridade 4 - Comissões e NF (11 funções)**
Sincronização de comissões e notas fiscais

**Prioridade 5 - Webhooks e Outros (26 funções)**
Webhooks, importações, utilitários

### Modificação necessária em cada arquivo:

Adicionar comentário de versão no início:
```typescript
// v2 - deploy fix 2026-02-06
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

E atualizar imports de `esm.sh` para `npm:`:
```typescript
import { createClient } from "npm:@supabase/supabase-js@2";
```

## Estimativa

- Total de funções para deploy: **84**
- Tempo estimado: Deploy em 5 lotes
