

# Deploy Massivo de Edge Functions Faltantes

## Diagnóstico

Realizei testes em todas as Edge Functions críticas do sistema e descobri que a **grande maioria não está deployada**.

### Funções que ESTÃO funcionando (4):
| Função | Status |
|--------|--------|
| `calculate-shipping` | ✅ Ativo (recém deployado) |
| `mp-create-order-and-pay` | ✅ Ativo (recém deployado) |
| `shopify-storefront-products` | ✅ Ativo (recém deployado) |
| `shopify-storefront-checkout` | ✅ Ativo (recém deployado) |

### Funções que NÃO estão deployadas (testadas):
| Função | Impacto |
|--------|---------|
| `ebd-shopify-sync-orders` | ❌ **Sincronização de pedidos online** |
| `ebd-shopify-backfill-items` | ❌ Backfill de itens de pedidos |
| `cg-shopify-sync-orders` | ❌ Sincronização Central Gospel |
| `bling-sync-order-status` | ❌ Status de pedidos Bling |
| `bling-create-order` | ❌ Criação de pedidos no Bling |
| `bling-sync-shopify-orders` | ❌ Sync Shopify-Bling |
| `bling-generate-nfe` | ❌ Geração de NF-e |
| `bling-check-nfe-status` | ❌ Status de NF-e |
| `bling-get-order-details` | ❌ Detalhes de pedidos |
| `sync-comissoes-nfe` | ❌ Sincronização de comissões |
| `sync-nf-danfe-batch` | ❌ Sincronização NF/DANFE |
| `mp-checkout-init` | ❌ Inicialização do checkout MP |
| `mercadopago-webhook` | ❌ Webhook Mercado Pago |
| `send-order-email` | ❌ Envio de emails |
| `send-welcome-email` | ❌ Email de boas-vindas |
| `ebd-brevo-webhook` | ❌ Webhook Brevo |
| `create-vendedor` | ❌ Criação de vendedores |
| `create-client` | ❌ Criação de clientes |
| `track-affiliate-click` | ❌ Tracking de afiliados |
| `gemini-assistente-gestao` | ❌ Assistente IA |
| `process-transparent-payment` | ❌ Pagamento transparente |

## Solução Proposta

Fazer deploy de todas as Edge Functions críticas. A abordagem será:

1. **Deploy das funções mais críticas primeiro** - relacionadas à sincronização e operações diárias
2. **Adicionar comentário de versão** a cada arquivo para forçar o build
3. **Verificar o deploy** após cada lote

### Prioridade de deploy:

**Lote 1 - Sincronização de Pedidos (mais crítico)**
- `ebd-shopify-sync-orders`
- `ebd-shopify-backfill-items`
- `cg-shopify-sync-orders`
- `mp-checkout-init`

**Lote 2 - Integração Bling**
- `bling-create-order`
- `bling-sync-order-status`
- `bling-sync-shopify-orders`
- `bling-generate-nfe`
- `bling-check-nfe-status`
- `bling-get-order-details`

**Lote 3 - Comissões e NF**
- `sync-comissoes-nfe`
- `sync-nf-danfe-batch`

**Lote 4 - Webhooks e Emails**
- `mercadopago-webhook`
- `send-order-email`
- `send-welcome-email`
- `ebd-brevo-webhook`

**Lote 5 - Outras funcionalidades**
- `create-vendedor`
- `create-client`
- `track-affiliate-click`
- `gemini-assistente-gestao`
- `process-transparent-payment`

### Modificação em cada arquivo

Adicionar comentário no início para forçar rebuild:

```typescript
// v2 - deploy fix 2026-02-05
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
```

## Resultado Esperado

Após o deploy:
- Sincronização de pedidos Shopify funcionará
- Integração com Bling operacional
- Checkout Mercado Pago completo
- Webhooks ativos para processar pagamentos
- Emails automáticos funcionando
- Todas as operações administrativas disponíveis

