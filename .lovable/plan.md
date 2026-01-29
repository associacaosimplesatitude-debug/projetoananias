
# Plano: Criar Usuário para Ronald Gustavo e Vincular ao Autor

## Situação Atual

| Item | Status | Detalhes |
|------|--------|----------|
| Autor "Ronald Gustavo" | ✅ Cadastrado | `id: b7afbdf2-a0fb-4c4c-b85c-b31f439c24b5` |
| Email do autor | ✅ | `ronald@centralgospel.com.br` |
| Livro "O Cativeiro Babilônico" | ✅ Vinculado | `autor_id` já aponta para Ronald |
| Usuário no sistema | ❌ Não existe | Precisa criar |
| Acesso ao Portal do Autor | ❌ Bloqueado | `user_id` está `null` |

---

## Ações Necessárias

### 1. Criar Usuário de Autenticação

Usar a edge function `create-auth-user-direct` para criar:
- **Email**: `ronald@centralgospel.com.br`
- **Senha**: Será definida (sugiro uma senha segura como `Ronald@2026!`)
- **Nome**: `Ronald Gustavo`

### 2. Vincular Usuário ao Autor

Atualizar a tabela `royalties_autores`:
```sql
UPDATE royalties_autores 
SET user_id = '{novo_user_id}'
WHERE id = 'b7afbdf2-a0fb-4c4c-b85c-b31f439c24b5';
```

### 3. Atribuir Role "autor"

Inserir na tabela `user_roles`:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('{novo_user_id}', 'autor');
```

---

## Resultado Esperado

Após as alterações:
- ✅ Ronald poderá fazer login com `ronald@centralgospel.com.br` + senha definida
- ✅ Terá acesso ao **Portal do Autor** (`/autor`)
- ✅ Verá seus livros, vendas e royalties
- ✅ Poderá editar seu perfil (telefone, dados bancários)

---

## Credenciais de Acesso

| Campo | Valor |
|-------|-------|
| Email | `ronald@centralgospel.com.br` |
| Senha | `Ronald@2026!` (sugestão - pode alterar) |
| URL de acesso | `/ebd-login` ou direto `/autor` |

---

## Seção Técnica

### Chamada da Edge Function

```typescript
// create-auth-user-direct
{
  email: "ronald@centralgospel.com.br",
  password: "Ronald@2026!",
  full_name: "Ronald Gustavo"
}
```

### Atualizações no Banco

1. **Update royalties_autores**: Vincular `user_id` retornado
2. **Insert user_roles**: Adicionar role `autor` para o novo usuário

### Fluxo de Execução

```text
1. Chamar edge function create-auth-user-direct
   → Retorna userId do novo usuário

2. UPDATE royalties_autores SET user_id = ? WHERE id = ?
   → Vincula autor ao usuário

3. INSERT INTO user_roles (user_id, role) VALUES (?, 'autor')
   → Libera acesso ao portal
```
