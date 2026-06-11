## Objetivo
Liberar o acesso à página `/admin/ebd/auditoria-vendedor` para o usuário `consultorti@editoracentralgospel.com`, mantendo o acesso do superadmin.

## Mudanças

1. **Novo guard `RequireAuditoriaAccess`** (`src/components/RequireAuditoriaAccess.tsx`)
   - Permite acesso se:
     - usuário é superadmin (via `useIsSuperadmin`), OU
     - email do usuário autenticado === `consultorti@editoracentralgospel.com` (case-insensitive).
   - Mesmo comportamento de loading/redirect do `RequireSuperadmin`.

2. **Atualizar rota em `src/App.tsx` (linha 587)**
   - Trocar `<RequireSuperadmin>` por `<RequireAuditoriaAccess>` apenas nesta rota. Demais rotas seguem com `RequireSuperadmin`.

Os itens de menu na sidebar (`AdminLayout.tsx` e `AdminEBDLayout.tsx`) já são renderizados sem restrição de superadmin, então o link aparecerá normalmente para o `consultorti`.

## Notas técnicas
- Email comparado via `user.email?.toLowerCase() === "consultorti@editoracentralgospel.com"`.
- Sem alterações no banco / RLS — o controle é apenas de UI/rota (a página apenas faz `SELECT` em tabelas de auditoria já acessíveis).