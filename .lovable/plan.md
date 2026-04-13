

## Diagnóstico

O erro persiste: **"No such destination: 'acct_1TJE3cKCVupxwxRr'"**

- O código na linha 101 do webhook faz: `Deno.env.get("STRIPE_TRANSFER_DESTINATION") || "acct_1TJE3cKCVupxwxRr"`
- O secret `STRIPE_TRANSFER_DESTINATION` **não existe** nos secrets do projeto
- O secret `STRIPE_CONNECTED_ACCOUNT` **existe** mas não está sendo usado
- Resultado: sempre cai no fallback hardcoded `acct_1TJE3cKCVupxwxRr`, que é inválido

## Plano

### 1. Corrigir `supabase/functions/stripe-webhook/index.ts` (linha 101)

Alterar a leitura do destination para usar `STRIPE_CONNECTED_ACCOUNT` (que é o secret que realmente existe):

```typescript
// Antes:
const destination = Deno.env.get("STRIPE_TRANSFER_DESTINATION") || "acct_1TJE3cKCVupxwxRr";

// Depois:
const destination = Deno.env.get("STRIPE_CONNECTED_ACCOUNT") || Deno.env.get("STRIPE_TRANSFER_DESTINATION") || "acct_1TJE3cKCVupxwxRr";
```

### 2. Adicionar log do destination para debug

Adicionar `console.log("Transfer destination:", destination);` antes da chamada para confirmar qual valor está sendo usado.

### 3. Redeploy da edge function

### 4. Verificar o valor do secret `STRIPE_CONNECTED_ACCOUNT`

Se mesmo após a correção a transferência falhar, o valor armazenado em `STRIPE_CONNECTED_ACCOUNT` pode estar incorreto e precisará ser atualizado com o account ID correto da House Assessoria (visível no dashboard do Stripe em Connect > Contas conectadas).

### Arquivos modificados
- `supabase/functions/stripe-webhook/index.ts` (única alteração)
- Nenhum arquivo do Mercado Pago será tocado

