

# Corrigir acesso do usuario elizeu@centralgospel.com.br

## Problema Identificado

O usuario `elizeu@centralgospel.com.br` possui **duas roles** na tabela `user_roles`:
- `financeiro` (role correta - e um funcionario da editora)
- `autor` (role incorreta - foi atribuida automaticamente quando o autor "DJALMA CORRE PINHO JUNIOR" foi cadastrado com esse email)

Isso causa dois problemas:

1. **`useAuth` quebra silenciosamente**: O hook usa `.maybeSingle()` para buscar a role, mas com 2 registros ele retorna erro, fazendo `role = null`.

2. **AutorLogin redireciona cegamente**: A pagina `/login/autor` redireciona para `/autor` assim que detecta um usuario logado, sem verificar se o usuario realmente tem role `autor`.

## Solucao

### 1. Remover a role `autor` incorreta do banco

Executar migracao para remover a role `autor` do usuario `elizeu@centralgospel.com.br`, mantendo apenas `financeiro`.

### 2. Corrigir AutorLogin.tsx para verificar a role

Alterar o `useEffect` na pagina `/login/autor` para verificar se o usuario realmente tem role `autor` antes de redirecionar. Se nao tiver, redirecionar para `/` (DashboardRedirect) que fara o roteamento correto.

```text
useEffect:
  if (user && role === 'autor') -> navigate('/autor')
  if (user && role && role !== 'autor') -> navigate('/')
```

### 3. Corrigir useAuth para lidar com multiplas roles

Alterar `fetchUserRole` em `useAuth.tsx` para usar prioridade de roles caso existam multiplas. A ordem de prioridade sera:
- admin > gerente_royalties > financeiro > gerente_ebd > representante > autor > client

Isso previne que o problema se repita com outros usuarios que possam ter roles duplicadas.

## Detalhes Tecnicos

### Migracao SQL

```text
DELETE FROM user_roles 
WHERE user_id = '84fb9588-b997-4754-8f83-5b5f45498ed6' 
AND role = 'autor';
```

### AutorLogin.tsx

- Importar `role` do `useAuth`
- Alterar useEffect para checar role antes de redirecionar
- Se role !== 'autor', redirecionar para '/'

### useAuth.tsx - fetchUserRole

- Trocar `.maybeSingle()` por `.select('role')` sem single
- Se retornar multiplas roles, usar a de maior prioridade
- Isso evita o erro silencioso quando um usuario tem mais de uma role

