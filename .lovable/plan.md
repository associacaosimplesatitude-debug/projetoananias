

## Plano: Mover Consultor de BI para /admin/ebd (Admin Only)

### Situação Atual

O componente **Consultor de BI** (`AIAssistantChat`) está atualmente no `AdminLayout.tsx` (linha 309), fazendo com que apareça em **todas as páginas administrativas**:
- `/admin` (Dashboard)
- `/admin/ebd` (Admin EBD)  
- `/admin/clients` (Clientes)
- Todas as outras rotas admin...

### O Que Será Alterado

Mover o Consultor de BI para aparecer **apenas** na página `/admin/ebd` e **somente** para usuários com role `admin` (Administrador Geral).

Usuários com roles `gerente_ebd` ou `financeiro` que acessam `/admin/ebd` **não verão** o assistente.

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/AdminLayout.tsx` | Remover import e renderização do AIAssistantChat |
| `src/pages/admin/AdminEBD.tsx` | Adicionar AIAssistantChat com verificação de role === 'admin' |

### Detalhes da Implementação

#### 1. AdminLayout.tsx
- **Remover** linha 2: import do AIAssistantChat
- **Remover** linhas 308-309: renderização do componente

#### 2. AdminEBD.tsx
- **Adicionar** import do AIAssistantChat
- **Adicionar** verificação `const isAdmin = role === 'admin'`
- **Renderizar** o componente condicionalmente: `{isAdmin && <AIAssistantChat />}`

### Fluxo de Verificação de Acesso

```text
Usuario acessa /admin/ebd
        |
        v
   Qual é o role?
        |
  +-----+-----+-----+
  |           |     |
admin    gerente  financeiro
  |        _ebd      |
  v           |      |
[VE CHAT]     v      v
         [NAO VE] [NAO VE]
```

### Segurança

A verificação é feita através do hook `useAuth()` que busca o role do usuário na tabela `user_roles`:

```typescript
const { role } = useAuth();
const isAdmin = role === 'admin';

// Apenas admin vê o assistente
{isAdmin && <AIAssistantChat />}
```

Esta verificação é segura porque:
- O role vem do banco de dados (tabela `user_roles`)
- Não pode ser manipulado pelo cliente
- Segue o padrão já utilizado no projeto

### Resultado Final

| Página | Usuário Admin | Gerente EBD | Financeiro |
|--------|--------------|-------------|------------|
| /admin | Não vê chat | N/A | N/A |
| /admin/ebd | **Vê chat** | Não vê | Não vê |
| /admin/clients | Não vê | N/A | N/A |

