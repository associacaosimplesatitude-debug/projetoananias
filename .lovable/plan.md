

## Plano: Criar usuário de teste completo para Revista Virtual

O cliente `Igreja Teste - Revista Virtual` existe no banco mas não tem usuário auth. Para testar, preciso:

### 1. Criar usuário auth via Edge Function `create-auth-user-direct`
- Email: `teste@revistas.com`
- Senha: `Teste123!`
- Isso cria o usuário no auth e o profile

### 2. Atribuir role `client` na tabela `user_roles`

### 3. Vincular o `superintendente_user_id` no registro `ebd_clientes`
- O componente `AlunoRevistaVirtual` busca o cliente pelo `email_superintendente` do usuário logado
- Precisa que `ebd_clientes.email_superintendente = 'teste@revistas.com'` (já está)
- Precisa que `ebd_clientes.superintendente_user_id` aponte para o user_id criado

### Execução
Uma única migração SQL que:
1. Chama a Edge Function via `net.http_post` OU insere diretamente — na verdade, o melhor é usar a Edge Function `create-auth-user-direct` via curl/invoke

**Abordagem mais simples:** Invocar a edge function `create-auth-user-direct` pelo frontend/admin existente, ou executar via migração com `extensions.http`.

**Melhor abordagem:** Usar o tool de curl para chamar a edge function diretamente, criando o usuário, e depois executar uma migração SQL para vincular o `user_id` e atribuir a role.

### Credenciais de teste
- **Email:** `teste@revistas.com`
- **Senha:** `Teste123!`
- **Role:** `client`

