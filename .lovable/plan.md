
# Corrigir o Webhook do WhatsApp - JWT Desabilitado

## Problema identificado
A funcao `whatsapp-webhook` nao esta registrada no `supabase/config.toml`. Por padrao, o Supabase exige um token JWT valido para chamar edge functions. Como a Z-API envia webhooks sem autenticacao, todas as mensagens recebidas estao sendo bloqueadas com erro 401.

Isso explica por que a resposta "SIM" nunca chegou ao sistema.

## Solucao

### Passo 1: Registrar a funcao no config.toml
Adicionar a configuracao `verify_jwt = false` para a funcao `whatsapp-webhook` no arquivo `supabase/config.toml`. Isso permite que a Z-API envie webhooks sem autenticacao.

```toml
[functions.whatsapp-webhook]
verify_jwt = false
```

### Passo 2: Importacao estavel
Trocar a importacao `esm.sh` por `npm:` no `supabase/functions/whatsapp-webhook/index.ts` para evitar problemas de deploy (conforme padrao do projeto).

```typescript
// De:
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Para:
import { createClient } from "npm:@supabase/supabase-js@2";
```

### Passo 3: Deploy e teste
Fazer o deploy da funcao e enviar uma nova mensagem de teste para validar que o fluxo completo funciona (mensagem de resumo > resposta "SIM" > credenciais automaticas).

## Secao Tecnica

### Arquivos alterados:
1. **`supabase/config.toml`** - Adicionar entrada `[functions.whatsapp-webhook]` com `verify_jwt = false` (ao final do arquivo)
2. **`supabase/functions/whatsapp-webhook/index.ts`** - Linha 1: trocar import de `esm.sh` para `npm:`
