
# Plano: Adicionar Botão "Voltar ao Dashboard" na Página de Perfil

## Problema

Quando o usuário acessa a página `/my-profile` para editar suas informações, não existe um botão para retornar ao dashboard. Isso dificulta a navegação do usuário.

## Solução

Adicionar um botão "Voltar ao Dashboard" no topo da página de perfil que redireciona o usuário para o dashboard correspondente ao seu perfil (role).

### Redirecionamento por Perfil

| Perfil | Dashboard |
|--------|-----------|
| admin | `/admin` |
| gerente_ebd | `/admin/ebd` |
| financeiro | `/admin/ebd/aprovacao-faturamento` |
| client (superintendente) | `/ebd/dashboard` |
| tesoureiro / secretario | `/dashboard` |
| Padrão | `/` |

### Interface Visual

O botão será posicionado acima do título "Meu Perfil", alinhado à esquerda, com um ícone de seta para a esquerda:

```
← Voltar ao Dashboard

Meu Perfil
```

---

## Seção Técnica

### Arquivo a Modificar

`src/pages/MyProfile.tsx`

### Alterações

1. **Importar** o hook `useNavigate` do react-router-dom
2. **Importar** o ícone `ArrowLeft` do lucide-react
3. **Usar** o hook `useAuth` para obter o `role` do usuário
4. **Criar função** `getDashboardUrl()` que retorna a URL correta baseada no role
5. **Adicionar botão** antes do título "Meu Perfil"

### Código a Adicionar

```typescript
// Adicionar imports
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// Dentro do componente
const { user, role } = useAuth();  // Adicionar role
const navigate = useNavigate();

// Função para determinar URL do dashboard
const getDashboardUrl = () => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'gerente_ebd':
      return '/admin/ebd';
    case 'financeiro':
      return '/admin/ebd/aprovacao-faturamento';
    case 'tesoureiro':
    case 'secretario':
      return '/dashboard';
    case 'client':
      return '/ebd/dashboard';
    default:
      return '/';
  }
};

// Antes do título "Meu Perfil"
<Button 
  variant="ghost" 
  onClick={() => navigate(getDashboardUrl())}
  className="mb-4 gap-2"
>
  <ArrowLeft className="h-4 w-4" />
  Voltar ao Dashboard
</Button>
```

### Resultado

Após a implementação:
- O botão aparecerá no topo da página de perfil
- Ao clicar, o usuário será redirecionado para seu dashboard apropriado
- O texto e ícone seguem o padrão visual já existente no sistema
