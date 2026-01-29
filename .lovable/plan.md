
# Plano: Corrigir Menu Superior Duplicado em /royalties

## Problema

O módulo Royalties está exibindo o menu de navegação principal (com "Admin EBD", "Clientes", "Financeiro", etc.) acima do seu layout próprio com sidebar. Isso ocorre porque o `ConditionalNavigation` não está configurado para ocultar a navegação nas rotas `/royalties` e `/autor`.

## Solução

Atualizar o componente `ConditionalNavigation.tsx` para incluir as rotas de Royalties e Autor na lógica de ocultação da navegação.

## Alteração

**Arquivo:** `src/components/layout/ConditionalNavigation.tsx`

Adicionar verificação para rotas `/royalties` e `/autor`:

```text
Antes:
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminEbdRoute = location.pathname.startsWith('/admin/ebd');

Depois:
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isAdminEbdRoute = location.pathname.startsWith('/admin/ebd');
  const isRoyaltiesRoute = location.pathname.startsWith('/royalties');
  const isAutorRoute = location.pathname.startsWith('/autor');
```

E atualizar a condição `shouldHideNavigation`:

```text
Antes:
  const shouldHideNavigation = 
    (isAluno && isAlunoRoute) || 
    (isProfessor && isProfessorRoute) ||
    (isVendedor && isVendedorRoute) ||
    (role === 'admin' && isAdminRoute) ||
    (isGerenteEbd && isAdminEbdRoute) ||
    (isFinanceiro && isAdminEbdRoute) ||
    isEbdSuperintendentRoute;

Depois:
  const shouldHideNavigation = 
    (isAluno && isAlunoRoute) || 
    (isProfessor && isProfessorRoute) ||
    (isVendedor && isVendedorRoute) ||
    (role === 'admin' && isAdminRoute) ||
    (isGerenteEbd && isAdminEbdRoute) ||
    (isFinanceiro && isAdminEbdRoute) ||
    isEbdSuperintendentRoute ||
    isRoyaltiesRoute ||
    isAutorRoute;
```

## Resultado Esperado

Ao acessar `/royalties` ou `/autor`, apenas o sidebar do Royalties/Autor será exibido, sem o menu de navegação principal no topo.
