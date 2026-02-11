

# Corrigir login do autor - Busca de usuario via REST API

## Problema
Quando o email do autor ja existe no sistema de autenticacao, a funcao `create-autor-user` nao consegue localizar o usuario para atualizar a senha. O SDK JS (`listUsers`) nao retorna o usuario mesmo com paginacao completa, resultando no erro "Usuario existe mas nao foi encontrado". Consequencia: a senha nunca e atualizada e o autor nao consegue fazer login.

## Solucao
Substituir a busca via SDK (`supabaseAdmin.auth.admin.listUsers`) por uma chamada direta a REST API Admin do Supabase Auth, que suporta filtro por email de forma confiavel.

## Detalhes tecnicos

**Arquivo:** `supabase/functions/create-autor-user/index.ts`

Quando o erro `email_exists` ocorrer, em vez de usar o loop de paginacao com `listUsers`, fazer:

```typescript
// Chamada direta a REST API Admin
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const response = await fetch(
  `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email.toLowerCase().trim())}`,
  {
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'apikey': serviceKey,
    },
  }
);

const usersData = await response.json();
const foundUser = usersData.users?.find(
  u => (u.email ?? '').toLowerCase().trim() === email.toLowerCase().trim()
);
```

### O que muda
- Remove o loop de paginacao (linhas 59-80) que percorria todos os usuarios
- Usa a REST API diretamente com filtro por email, que e mais confiavel que o SDK
- Faz match exato apos receber os resultados filtrados
- Mantem toda a logica existente de atualizacao de senha e atribuicao de role

### Fluxo completo apos a correcao
1. Tenta criar usuario novo
2. Se email ja existe -> busca via REST API com filtro
3. Encontra usuario -> atualiza senha e confirma email
4. Cria/atualiza perfil na tabela `profiles`
5. Atribui role `autor` se nao existir
6. Autor consegue fazer login com as credenciais

