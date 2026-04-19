
Plano simples e cirúrgico. Duas alterações pequenas no `ebd-shopify-order-webhook` + criação de secret.

## 1. URL pública da função

```
https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/ebd-shopify-order-webhook
```

(Project ref: `nccyrvfnvjngfyfvgnww` — confirmado nas credenciais do projeto.)

## 2. Secret INTERNAL_WEBHOOK_SECRET

Gerar valor aleatório forte (64 chars hex = 256 bits) e cadastrar como secret runtime do projeto.

**Importante:** o valor será gerado e exibido **uma única vez** na resposta da execução (modo default). Após cadastrado via `add_secret`, fica acessível apenas via `Deno.env.get('INTERNAL_WEBHOOK_SECRET')` dentro de edge functions.

## 3. Alteração no código (cirúrgica)

**Arquivo:** `supabase/functions/ebd-shopify-order-webhook/index.ts`

**Onde:** logo no início do `serve(...)`, antes do parse do body, **substituir** o bloco atual de validação HMAC Shopify por uma função que aceita **OU** caminho A **OU** caminho B.

**Pseudocódigo do novo bloco:**

```ts
// Lê body raw uma única vez (necessário pra HMAC)
const rawBody = await req.text();

const shopifyHmac        = req.headers.get('x-shopify-hmac-sha256');
const internalSource     = req.headers.get('x-internal-source');
const internalSecretHdr  = req.headers.get('x-internal-secret');

const SHOPIFY_SECRET  = Deno.env.get('SHOPIFY_WEBHOOK_SECRET');
const INTERNAL_SECRET = Deno.env.get('INTERNAL_WEBHOOK_SECRET');

// Caminho A: HMAC Shopify (legado, intacto)
let originOk = false;
let originType = '';
if (shopifyHmac && SHOPIFY_SECRET) {
  const computed = await computeShopifyHmac(rawBody, SHOPIFY_SECRET);
  if (computed === shopifyHmac) { originOk = true; originType = 'shopify-hmac'; }
}

// Caminho B: header interno (nova loja CG Store)
if (!originOk
    && internalSource === 'central-gospel-store'
    && INTERNAL_SECRET
    && internalSecretHdr
    && timingSafeEqual(internalSecretHdr, INTERNAL_SECRET)) {
  originOk = true;
  originType = 'internal-cg-store';
}

if (!originOk) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

console.log(`[origem aceita] ${originType}`);

// daqui pra baixo TUDO continua igual: JSON.parse(rawBody) + fluxo atual
```

**Detalhes:**
- Comparação da secret interna usa `timingSafeEqual` (constant-time) pra evitar timing attack.
- `corsHeaders` já existe no arquivo — adicionar `x-internal-source, x-internal-secret` ao `Access-Control-Allow-Headers`.
- Body shape Shopify (`order.id`, `line_items[]`, `customer`, `billing_address`, etc.) **não muda** — a CG Store envia idêntico.
- Nada do bloco de revista digital, email Resend, WhatsApp Meta, upsert de `revista_licencas_shopify`, comissões ou funil é tocado.

## 4. Passos de execução (modo default)

1. `add_secret INTERNAL_WEBHOOK_SECRET` com valor `crypto.randomBytes(32).toString('hex')` gerado na hora — exibir o valor **uma vez** no chat.
2. Atualizar `Access-Control-Allow-Headers` em `corsHeaders` (linha ~6 do arquivo) adicionando `x-internal-source, x-internal-secret`.
3. Substituir bloco de validação HMAC atual (~linhas 30-60) pelo bloco dual acima, mantendo `rawBody`/`order = JSON.parse(rawBody)` para o resto do fluxo.
4. Deploy da função.
5. Teste rápido (curl) com header interno + secret pra confirmar 200; teste sem nada pra confirmar 401.

## 5. Entregáveis na próxima resposta (default mode)

1. ✅ URL pública: `https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/ebd-shopify-order-webhook`
2. ✅ Valor da `INTERNAL_WEBHOOK_SECRET` (exibido **uma vez** no chat — copiar imediatamente).
3. ✅ Confirmação: payload continua no shape Shopify `orders/paid` (sem mudança de contrato).

## Restrições respeitadas

- HMAC Shopify continua funcionando (caminho A intacto).
- Nenhum efeito colateral: licença, email, WhatsApp, comissão, funil — todos preservados.
- Apenas adiciona caminho B + leitura de uma nova env var.
