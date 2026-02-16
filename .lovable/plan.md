
# Plano: Criacao Automatica de Usuario no Webhook Shopify + Envio Imediato da Fase 1

## Resumo

Quando um pedido **pago** chega do Shopify, o sistema vai automaticamente:
1. Gerar uma senha temporaria
2. Criar o usuario no Auth (ou atualizar se ja existir)
3. Salvar as credenciais no `ebd_clientes`
4. Inserir o cliente no funil pos-venda (`funil_posv_tracking`)
5. Enviar imediatamente a mensagem de Fase 1 (boas-vindas + credenciais) via WhatsApp
6. Bloquear a ativacao manual pelo vendedor para clientes vindos do Shopify

O cron diario (09h BRT) continuara responsavel apenas pelas fases 2 em diante.

---

## Mudancas Detalhadas

### 1. Edge Function: `ebd-shopify-order-webhook/index.ts`

Adicionar um bloco **apos o upsert do pedido** (linha ~399) e **dentro do bloco `if (statusPagamento === "paid")`** (linha ~402):

**Novo fluxo quando `financial_status === "paid"`:**

a) **Verificar se ja existe cliente** vinculado (`clienteId`) ou buscar por `customer_email` na tabela `ebd_clientes`.

b) **Gerar senha temporaria** aleatoria (8 caracteres alfanumericos).

c) **Criar usuario Auth** chamando a REST API Admin do Supabase (`/auth/v1/admin/users`) com o email da compra e a senha gerada. Se o usuario ja existir, atualizar a senha.

d) **Atualizar `ebd_clientes`** com:
   - `superintendente_user_id`
   - `email_superintendente` (email da compra Shopify)
   - `senha_temporaria`
   - `status_ativacao_ebd = true`
   - `is_pos_venda_ecommerce = true`

e) **Inserir no `funil_posv_tracking`** com `fase_atual = 1` (ON CONFLICT DO NOTHING).

f) **Enviar mensagem WhatsApp Fase 1** imediatamente usando Z-API (mesma logica do cron). A mensagem inclui credenciais de acesso e link rastreavel.

g) **Atualizar `funil_posv_tracking`** com `fase1_enviada_em` e `ultima_mensagem_em`.

**Logica de seguranca:** So executa se:
- `statusPagamento === "paid"`
- Existe um `clienteId` vinculado (ja encontrado ou encontrado por email)
- O cliente ainda NAO tem `superintendente_user_id` (evita recriar em atualizacoes)

### 2. Frontend: `AtivarClienteDialog.tsx`

Adicionar verificacao antes de permitir ativacao manual:

- Ao abrir o dialog, verificar se o cliente tem pedido na tabela `ebd_shopify_pedidos` (vinculado por `cliente_id` ou `customer_email`).
- Se tiver pedido Shopify: exibir mensagem informativa dizendo que clientes do e-commerce sao ativados automaticamente e **desabilitar o botao de ativacao**.
- Se NAO tiver pedido Shopify (cliente cadastrado manualmente ou vindo do Bling): permitir ativacao normal como hoje.

### 3. Edge Function: `funil-posv-cron/index.ts`

Pequeno ajuste:

- Na Fase 1, o cron **nao tentara enviar** a mensagem de boas-vindas se `fase1_enviada_em` ja estiver preenchido (o webhook ja enviou).
- O cron continuara processando normalmente as fases 2, 3, 4 e 5.
- Isso ja funciona com a logica atual (o cron so processa Fase 1 -> 2 quando `fase1_enviada_em` existe), mas vamos garantir que nao haja duplicacao.

---

## Secao Tecnica

### Geracao de senha no webhook

```typescript
function generateTempPassword(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    password += chars[byte % chars.length];
  }
  return password;
}
```

### Criacao de usuario via REST API Admin

Seguindo o padrao ja estabelecido no projeto (memoria: `edge-functions-auth-user-lookup-rest-api`):

```typescript
const authResponse = await fetch(
  `${SUPABASE_URL}/auth/v1/admin/users`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: customerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: customerName },
    }),
  }
);
```

Se retornar erro `email_exists`, busca o usuario existente e atualiza a senha via PUT.

### Envio WhatsApp inline

Reutiliza a mesma logica de `sendWhatsAppMessage` que ja existe no `funil-posv-cron`, trazendo-a como funcao compartilhada ou duplicando no webhook (mais simples e independente).

### Bloqueio no frontend

```typescript
// Em AtivarClienteDialog, antes de renderizar o form:
const { data: pedidoShopify } = await supabase
  .from("ebd_shopify_pedidos")
  .select("id")
  .eq("cliente_id", cliente.id)
  .eq("status_pagamento", "paid")
  .limit(1)
  .maybeSingle();

if (pedidoShopify) {
  // Mostrar aviso e desabilitar ativacao
}
```

---

## Fluxo Final

```text
Compra paga no Shopify
    |
    v
Webhook recebe pedido
    |
    v
Salva em ebd_shopify_pedidos (ja existe)
    |
    v
[NOVO] Gera senha + Cria usuario Auth
    |
    v
[NOVO] Atualiza ebd_clientes com credenciais
    |
    v
[NOVO] Insere no funil_posv_tracking (fase 1)
    |
    v
[NOVO] Envia WhatsApp Fase 1 (boas-vindas + credenciais)
    |
    v
Cron diario cuida das fases 2-5
```

---

## O que NAO muda

- Clientes cadastrados manualmente ou vindos do Bling continuam sendo ativados pelo vendedor via `AtivarClienteDialog`
- O cron diario continua rodando normalmente para fases 2-5
- A logica de heranca de vendedor no webhook permanece intacta
- O `create-ebd-user` Edge Function continua existindo para uso manual (Bling/cadastro)
