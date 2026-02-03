
# Plano: Adicionar Gestão de Usuários do Sistema para Gerente EBD

## Objetivo

Criar uma funcionalidade no perfil do Gerente EBD (como `consultorti@editoracentralgospel.com`) para cadastrar usuários do sistema com os seguintes perfis:

| Tipo | Descrição | Acesso |
|------|-----------|--------|
| **Gerente EBD** | Visualiza tudo no Admin EBD | Todas as funcionalidades do painel EBD |
| **Vendedor** | Cadastra clientes, propostas, pedidos | Portal do Vendedor |
| **Financeiro** | Acesso restrito a financeiro | Aprovação de faturamento, comissões |

## Solução Proposta

### 1. Nova Página: Gestão de Usuários do Sistema

Criar uma página em `/admin/ebd/usuarios` acessível apenas para usuários com role `gerente_ebd` que permite:

- Listar usuários existentes (Gerentes, Vendedores, Financeiros)
- Criar novos usuários com formulário simples
- Editar role e resetar senha
- Excluir usuários

### 2. Interface do Formulário de Cadastro

O formulário terá os campos:
- **Nome Completo** (obrigatório)
- **Email** (obrigatório, único)
- **Senha** (obrigatório, mínimo 6 caracteres)
- **Tipo de Perfil** (dropdown):
  - Gerente EBD - acesso total ao Admin EBD
  - Vendedor - acesso ao portal de vendas
  - Financeiro - acesso às aprovações financeiras

### 3. Lógica de Criação

Para cada tipo de perfil:

| Perfil | Ação |
|--------|------|
| **Gerente EBD** | Chama `create-admin-user` com role `gerente_ebd` |
| **Financeiro** | Chama `create-admin-user` com role `financeiro` |
| **Vendedor** | Chama `create-vendedor` (lógica existente) |

### 4. Menu Lateral

Adicionar novo item "Usuários do Sistema" no menu lateral do Admin EBD, visível apenas para `gerente_ebd`:

```
📊 Painel Principal
├── Dashboard
├── Propostas
├── ...
└── 👤 Usuários do Sistema (NOVO - só gerente_ebd)
```

---

## Seção Técnica

### Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/admin/EBDSystemUsers.tsx` | Nova página de gestão de usuários |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/AdminEBDLayout.tsx` | Adicionar item de menu "Usuários do Sistema" |
| `src/App.tsx` | Adicionar rota `/admin/ebd/usuarios` |

### Estrutura do Componente EBDSystemUsers.tsx

```typescript
// Estados
- users: lista de usuários (gerentes, vendedores, financeiros)
- createDialogOpen: controle do modal de criação
- formData: { nome, email, senha, tipoPerfil }
- loading states

// Queries
- fetchUsers: busca profiles + user_roles + vendedores
- createMutation: 
  - Se tipoPerfil === 'vendedor' → invoke('create-vendedor')
  - Senão → invoke('create-admin-user')

// UI
- Tabela com: Nome, Email, Tipo, Data, Ações
- Dialog de criação com formulário
- Dialog de edição de role
- Confirmação de exclusão
```

### Alteração no AdminEBDLayout.tsx

Adicionar no menu, visível apenas para `isGerenteEbd`:

```typescript
{isGerenteEbd && (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={isActive('/admin/ebd/usuarios')}>
      <RouterNavLink to="/admin/ebd/usuarios">
        <UserPlus className="h-4 w-4" />
        <span>Usuários do Sistema</span>
      </RouterNavLink>
    </SidebarMenuButton>
  </SidebarMenuItem>
)}
```

### Alteração no App.tsx

Adicionar rota protegida:

```typescript
<Route 
  path="/admin/ebd/usuarios" 
  element={
    <ProtectedRoute requireAdmin allowGerenteEbd>
      <AdminEBDLayout>
        <EBDSystemUsers />
      </AdminEBDLayout>
    </ProtectedRoute>
  } 
/>
```

### Fluxo de Criação de Usuário

```text
Gerente EBD clica em "Novo Usuário"
         │
         ▼
Preenche formulário (nome, email, senha, tipo)
         │
         ▼
Submete formulário
         │
         ├─► Se tipo = "vendedor"
         │       └─► invoke('create-vendedor', { email, password, nome, tipo_perfil: 'vendedor' })
         │
         ├─► Se tipo = "gerente_ebd"  
         │       └─► invoke('create-admin-user', { email, password, fullName, role: 'gerente_ebd' })
         │
         └─► Se tipo = "financeiro"
                 └─► invoke('create-admin-user', { email, password, fullName, role: 'financeiro' })
```

### Segurança

- A Edge Function `create-admin-user` já existe e aceita roles válidos
- A Edge Function `create-vendedor` já valida se quem chama é admin ou gerente_ebd
- RLS policies existentes protegem as tabelas `user_roles`, `profiles`, `vendedores`
- Acesso à página protegido por `ProtectedRoute` com `allowGerenteEbd`

### Resultado Esperado

Após implementação:
- Gerente EBD terá acesso a `/admin/ebd/usuarios`
- Poderá criar novos Gerentes, Vendedores e usuários Financeiros
- Usuários criados terão acesso imediato às suas áreas
- Lista unificada mostrará todos os tipos de usuários do sistema EBD
