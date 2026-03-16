

## Plano: Ativar Webhook Automático para Pedidos Shopify Pagos

### Diagnóstico

1. **`ebd-shopify-order-webhook`**: Processa TODOS os pedidos recebidos (qualquer `financial_status`). Não filtra por `paid` — salva tudo via upsert. O auto-provisioning (criar usuário, funil pós-venda) já roda apenas quando `statusPagamento === 'paid'`, mas o upsert acontece para qualquer status.

2. **`shopify-register-webhook`**: Tem um bug na lógica de roteamento — quando o topic é `orders/create`, aponta para `shopify-orders-webhook` (função antiga de debug). Para qualquer outro topic, aponta para `ebd-shopify-order-webhook`. Ou seja, **nunca registra corretamente o topic `orders/paid`** apontando para a edge function certa.

3. **Verificação de duplicata**: O check `w.address.includes("shopify")` é muito genérico e pode detectar webhooks antigos como "já existentes" incorretamente.

### Alterações necessárias

#### 1. Edge Function `shopify-register-webhook` — Corrigir roteamento

- Sempre apontar para `ebd-shopify-order-webhook` independente do topic
- Default do topic muda de `orders/create` para `orders/paid` (captura apenas pedidos com pagamento confirmado)
- Melhorar verificação de duplicata: comparar `address` exatamente com a URL gerada

#### 2. Edge Function `ebd-shopify-order-webhook` — Adicionar filtro de status

- No início do processamento, após parsear o payload, verificar `financial_status`
- Se **não for `paid`**: retornar 200 OK com log "Pedido ignorado (status: {status})" sem processar
- Se for `paid`: continuar com o fluxo atual normalmente

#### 3. Página `PedidosOnline.tsx` — Botão "Registrar Webhook"

- Adicionar botão discreto ao lado do "Sincronizar Pedidos"
- Ícone: `Webhook` do lucide-react
- Mutation chama `supabase.functions.invoke('shopify-register-webhook', { body: { topic: 'orders/paid' } })`
- Sucesso: toast verde com ID do webhook e topic registrado
- Erro: toast vermelho com mensagem de erro

### Arquivos impactados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/shopify-register-webhook/index.ts` | Corrigir roteamento: sempre apontar para `ebd-shopify-order-webhook`, default topic `orders/paid` |
| `supabase/functions/ebd-shopify-order-webhook/index.ts` | Adicionar filtro: ignorar pedidos com `financial_status !== 'paid'` |
| `src/pages/shopify/PedidosOnline.tsx` | Adicionar botão "Registrar Webhook" com mutation |

