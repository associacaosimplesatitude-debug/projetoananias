
# Plano: Corrigir Listagem de Gerentes e Financeiros

## Problema Identificado

O usuário **CEO ELBA** (`ceo@elba.com.br`) foi criado com sucesso e está no banco de dados com role `gerente_ebd`, mas não aparece na listagem porque a query está falhando.

**Erro no Console:**
```
Could not find a relationship between 'user_roles' and 'user_id' in the schema cache
```

### Causa Raiz

A query atual tenta fazer um embedded join usando sintaxe de relacionamento:
```typescript
.select(`
  user_id,
  role,
  created_at,
  profiles:user_id (email, full_name)  // ← Relacionamento não existe
`)
```

Mas não existe um foreign key relationship definido entre `user_roles.user_id` e `profiles.id` no schema do Supabase, então o PostgREST não consegue resolver o join.

### Dados no Banco (confirmado)

O usuário está corretamente salvo:

| user_id | role | email | full_name |
|---------|------|-------|-----------|
| ae6f65da-... | gerente_ebd | ceo@elba.com.br | CEO ELBA |

Mas a query falha e retorna vazio.

## Solução

Modificar a query para fazer **duas consultas separadas**:
1. Buscar os dados de `user_roles`
2. Buscar os dados de `profiles` correspondentes

Ou fazer uma consulta direta à tabela profiles com os user_ids obtidos.

---

## Seção Técnica

### Arquivo a Modificar

`src/pages/admin/EBDSystemUsers.tsx`

### Alteração na Query (linhas 102-113)

**Antes (FALHA):**
```typescript
const { data: roleUsers, error: roleError } = await supabase
  .from("user_roles")
  .select(`
    user_id,
    role,
    created_at,
    profiles:user_id (
      email,
      full_name
    )
  `)
  .in("role", ["gerente_ebd", "financeiro"]);
```

**Depois (FUNCIONA):**
```typescript
// 1. Buscar roles
const { data: roleUsers, error: roleError } = await supabase
  .from("user_roles")
  .select("user_id, role")
  .in("role", ["gerente_ebd", "financeiro"]);

if (roleError) {
  console.error("Error fetching role users:", roleError);
} else if (roleUsers && roleUsers.length > 0) {
  // 2. Buscar profiles correspondentes
  const userIds = roleUsers.map(r => r.user_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name, created_at")
    .in("id", userIds);

  if (!profilesError && profiles) {
    // 3. Combinar os dados
    roleUsers.forEach(ru => {
      const profile = profiles.find(p => p.id === ru.user_id);
      if (profile) {
        systemUsers.push({
          id: ru.user_id,
          email: profile.email || "",
          fullName: profile.full_name || profile.email || "",
          role: ru.role as UserProfile,
          createdAt: profile.created_at,
        });
      }
    });
  }
}
```

### Resultado Esperado

Após a correção:
- **CEO ELBA** (`ceo@elba.com.br`) aparecerá na listagem com perfil "Gerente EBD"
- Todos os 11 usuários com roles (gerentes e financeiros) aparecerão
- O contador de "Gerentes EBD" mostrará o número correto (atualmente 5)
- O contador de "Financeiros" mostrará o número correto (atualmente 6)
