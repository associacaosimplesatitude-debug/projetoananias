

## Plano: Corrigir Conta do Daniel e Bug de Criação de Usuários EBD

### Resumo do Problema

1. **Daniel perdeu acesso** porque sua conta de autenticação foi sobrescrita/excluída
2. **Dois clientes EBD** (Israel e Glivando) tiveram seus `superintendente_user_id` apontando para profiles com email de Daniel
3. **Bug na função `create-ebd-user`** está reutilizando profiles existentes ao invés de criar novos

### Ações de Correção

#### Parte 1: Restaurar Conta do Daniel

**Dados do vendedor:**
- Email: `daniel.sousa@editoracentralgospel.com`  
- Senha: `124578`

**Passos:**
1. Criar novo usuário no `auth.users` com o email e senha fornecidos
2. Criar/atualizar profile vinculado ao novo auth ID
3. Verificar se vendedor consegue logar

---

#### Parte 2: Corrigir Dados dos Clientes EBD

| Cliente | Email Superintendente | Situação Atual | Correção |
|---------|----------------------|----------------|----------|
| Vix Elevadores | israel@vixelevadores.com.br | `superintendente_user_id` aponta para profile de Daniel | Criar nova conta auth para Israel e atualizar |
| Cliente Glivando | glivando201701@outlook.com | `superintendente_user_id` aponta para profile de Daniel | Criar nova conta auth para Glivando e atualizar |

---

#### Parte 3: Limpar Profiles Corrompidos

Os profiles que foram sobrescritos com email de Daniel precisam ser corrigidos ou excluídos para evitar confusão futura.

---

#### Parte 4: Corrigir Bug na Função `create-ebd-user`

**Arquivo:** `supabase/functions/create-ebd-user/index.ts`

**Problema identificado:** A função busca usuário por email no `auth.users`, mas quando o email não existe, ela cria um novo usuário. Porém, ao criar o profile, ela faz um `upsert` que pode sobrescrever profiles existentes se houver conflito de ID.

**Correção:**
- Ao criar novo usuário, garantir que o profile também seja novo (não upsert com ID de outro usuário)
- Adicionar verificação se o email já está em uso em outro profile antes de prosseguir
- Melhorar logs para identificar esses casos

---

### Ordem de Execução

1. **Imediato:** Criar conta de autenticação para Daniel com a senha `124578`
2. **Corrigir clientes:** Criar contas separadas para Israel e Glivando
3. **Limpar dados:** Remover profiles corrompidos
4. **Prevenir futuro:** Atualizar função `create-ebd-user` para evitar reuso de profiles

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/create-ebd-user/index.ts` | Corrigir lógica de criação/atualização de profiles |

### Ações via SQL/Edge Function

- Usar edge function `create-auth-user-direct` para criar conta do Daniel
- Atualizar `ebd_clientes` para corrigir os `superintendente_user_id`

