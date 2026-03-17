

## Problema

Gabriel (`gabriel.lourenco@editoracentralgospel.com`) tem role `gerente_ebd` na tabela `user_roles` **e** também está na tabela `vendedores`. 

Nas páginas de login (`Auth.tsx` e `EBDLogin.tsx`), o `handlePostLoginRedirect` verifica se o usuário é **vendedor primeiro** (pelo email na tabela `vendedores`) e redireciona para `/vendedor` **sem nunca checar a role** (`gerente_ebd`, `admin`, etc.). Por isso ele cai no painel de vendedor em vez do Admin EBD.

## Solução

Alterar o `handlePostLoginRedirect` em **ambos os arquivos** (`src/pages/Auth.tsx` e `src/pages/EBDLogin.tsx`) para verificar a role do usuário **antes** de checar a tabela `vendedores`.

Lógica nova no início da função:

```typescript
// 0. Verificar role do usuário (admin, gerente_ebd, financeiro, gerente_royalties)
const { data: userRoleData } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id);

const roles = userRoleData?.map(r => r.role) || [];
const ROLE_PRIORITY = ['admin', 'gerente_royalties', 'financeiro', 'gerente_ebd'];
const priorityRole = ROLE_PRIORITY.find(r => roles.includes(r));

if (priorityRole === 'admin') {
  navigate('/admin'); return;
}
if (priorityRole === 'gerente_royalties') {
  navigate('/royalties'); return;
}
if (priorityRole === 'financeiro') {
  navigate('/admin/ebd/aprovacao-faturamento'); return;
}
if (priorityRole === 'gerente_ebd') {
  navigate('/admin/ebd'); return;
}

// 1. VENDEDOR - verificar pelo email (continua como está)
```

Isso garante que usuários com roles administrativas sejam redirecionados para o painel correto, mesmo que também estejam cadastrados como vendedores.

