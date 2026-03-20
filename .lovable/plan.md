

## Plano: Criar usuário com acesso exclusivo ao Sorteio & Embaixadoras

### Problema
O sistema atual só permite acesso ao `/admin/ebd` para roles `admin`, `gerente_ebd` e `financeiro`. Precisamos de um usuário que veja **apenas** o menu "Sorteio & Embaixadoras".

### Solução
Criar uma nova role `gerente_sorteio` e ajustar o sistema de permissões.

### 1. Migration SQL
- Adicionar `gerente_sorteio` ao enum `app_role`
- Criar o usuário via edge function existente (`create-ebd-user`) ou criar direto na migration

### 2. Criar o usuário auth + atribuir role
Usar a edge function `create-ebd-user` (ou chamar diretamente) para criar:
- Email: `sorteio@centralgospel.com.br`
- Senha: `124578`
- Atribuir role `gerente_sorteio` na tabela `user_roles`

### 3. Atualizar `ProtectedRoute.tsx`
Adicionar prop `allowGerenteSorteio` e permitir acesso ao `/admin/ebd` para essa role.

### 4. Atualizar `AdminEBDLayout.tsx` (Sidebar)
- Detectar `role === 'gerente_sorteio'`
- Quando for essa role, mostrar **apenas** o menu "Sorteio & Embaixadoras" na sidebar, escondendo todos os outros menus (Dashboard, Vendas, Pedidos, etc.)

### 5. Atualizar `App.tsx`
Na rota `/admin/ebd`, adicionar a prop para permitir `gerente_sorteio`:
```
<ProtectedRoute requireAdmin allowGerenteEbd allowFinanceiro allowGerenteSorteio>
```

### 6. Atualizar `useAuth.tsx`
Adicionar `gerente_sorteio` na lista de roles e no ROLE_PRIORITY.

### 7. Atualizar redirecionamento pós-login
Quando o usuário com role `gerente_sorteio` fizer login, redirecionar direto para `/admin/ebd/sorteio`.

### Arquivos alterados
- `src/components/ProtectedRoute.tsx` — nova prop `allowGerenteSorteio`
- `src/components/admin/AdminEBDLayout.tsx` — filtrar sidebar por role
- `src/App.tsx` — adicionar prop na rota
- `src/hooks/useAuth.tsx` — adicionar role no priority
- `src/hooks/useUserRole.tsx` — adicionar tipo
- Migration: adicionar valor ao enum + inserir user_role
- Edge function call ou migration para criar o auth user

