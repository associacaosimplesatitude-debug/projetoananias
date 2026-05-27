## Diagnóstico

A aba E-commerce em `/admin/ebd/revista-licencas` está vazia ("Vendas totais" 0, "Ativas" 0) e retorna **401 Unauthorized** da função `revista-licencas-shopify-admin`. O card "CG Digital" mostra 1402 porque ele usa outra RPC (`execute_readonly_query`) que não passa pela edge function.

Causas identificadas no arquivo restaurado `supabase/functions/revista-licencas-shopify-admin/index.ts`:

1. **Role `superadmin` não está autorizada.** O check só permite `admin` e `gerente_ebd`:
   ```ts
   const hasAccess = (roles || []).some((r) =>
     ["admin", "gerente_ebd"].includes(r.role)
   );
   ```
   Usuários que só têm `superadmin` (sem `admin`) caem em 403 — e, como o frontend mostra a mensagem genérica do `functions.invoke`, aparece como 401.

2. **Função não foi redeployada após o restore.** Os logs só mostram `boot/shutdown`, sem requisições — indício forte de que a versão ativa no servidor é a antiga / não foi atualizada após o restore. Redeploy força sincronizar com o arquivo restaurado.

3. **Mensagem de erro pobre.** Hoje só responde `{"error":"Unauthorized"}` sem dizer se é "sem Authorization", "getUser falhou" ou "sem role". Dificulta diagnóstico futuro.

## Correção (mínima, só na edge function — sem mexer no frontend)

### Arquivo: `supabase/functions/revista-licencas-shopify-admin/index.ts`

a) **Incluir `superadmin`** no array de roles autorizadas:
```ts
const hasAccess = (roles || []).some((r) =>
   ["admin", "gerente_ebd", "superadmin"].includes(r.role)
);
```

b) **Logar o motivo do 401/403** (`console.log` com `userId`, presença de `authHeader`, roles encontradas) para facilitar próximos diagnósticos.

c) **Não alterar mais nada** — manter o restante exatamente como está na versão restaurada, incluindo as actions `list`, `insert`, `deactivate`, `resend`, etc.

### Deploy

Redeployar **apenas** `revista-licencas-shopify-admin` via `supabase--deploy_edge_functions` e validar com `supabase--curl_edge_functions` (action `list`) que retorna `data` com as licenças.

## Fora do escopo

- Não vou tocar em `RevistaLicencasAdmin.tsx` nem em outras funções (`revista-admin-impersonate`, `liberar-presente-cartas-prisao`). O usuário restaurou para a versão estável de ontem e quero manter assim — só corrijo o que está bloqueando a aba E-commerce.
- Tracking de email (enviado/aberto/clicou) e botão "Ver como cliente" ficam para uma próxima rodada, depois de confirmado que a tela voltou a funcionar.

## Validação

1. Após o deploy, recarregar `/admin/ebd/revista-licencas` → aba E-commerce.
2. Esperado: cards "Vendas totais" e "Ativas" com números > 0 e a lista preenchida.
3. Se ainda houver 401, conferir nos logs o motivo (auth header ausente, getUser, sem role) — agora será visível.
