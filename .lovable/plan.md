

# Diagnóstico: Pedido #2969 (R$ 5,14) — Licença e email não processados

## O que encontrei

1. **O pedido existe** no banco (`ebd_shopify_pedidos`): order #2969, R$ 5,14, `cleuton.soares@gmail.com`, status `paid`
2. **A tabela `revista_licencas_shopify` está vazia** — nenhuma licença foi criada
3. **Não há nenhum log** do `ebd-shopify-order-webhook` nos analytics recentes — o webhook **nunca foi chamado** pelo Shopify para este pedido
4. O pedido foi importado via `ebd-shopify-sync-orders` (sync manual), mas o webhook `orders/paid` não disparou

## Causa raiz

O webhook do Shopify (`orders/paid`) **não disparou** para o pedido #2969. Possíveis razões:
- A edge function foi editada mas **não foi redeployada** — sem deploy, o Shopify pode estar recebendo erros 500 nas tentativas anteriores e parou de retentar
- O webhook pode ter sido removido/desconfigurado no Shopify

## Plano de correção

### Passo 1 — Redeployar a edge function
Deployar `ebd-shopify-order-webhook` com todas as correções já feitas (SUPABASE_URL, idempotência, maybeSingle, email via Resend).

### Passo 2 — Re-registrar o webhook no Shopify
Usar o botão "Registrar Webhook" em `/admin/ebd/pedidos-online` para garantir que o webhook está ativo.

### Passo 3 — Processar manualmente o pedido #2969
Como o webhook não vai ser retransmitido pelo Shopify, precisamos disparar o processamento manualmente. Duas opções:
- **Opção A**: Chamar a edge function via `curl` simulando o payload do pedido #2969
- **Opção B**: Criar a licença manualmente via painel admin em `/admin/ebd/revista-licencas` (aba Vendas Shopify → Criar Licença Manual)

### Detalhes técnicos
- SKU do produto: `REV-N07-2026` (mapeado para revista digital `503e5583-2f3f-4b75-819e-bd241c590bc4`)
- WhatsApp do comprador: precisa ser extraído do pedido Shopify
- Email: `cleuton.soares@gmail.com`
- Após criar a licença, o email de boas-vindas via Resend será enviado automaticamente pelo webhook (opção A) ou manualmente (opção B)

