

# Criar Acesso de Superintendente para Teste

## Situacao Atual
- O cliente "Igreja Teste WhatsApp" ja existe na tabela `ebd_clientes` (ID: `9a1b4214-18a4-4311-84a7-c248bac2e24a`)
- Email: `teste.whatsapp@gestaoebd.com`
- Status EBD: ativo
- **Problema**: Nao existe usuario na tabela `auth.users` e o campo `superintendente_user_id` esta vazio

## O que sera feito

### Passo 1 - Criar usuario auth
Usar a Edge Function `create-auth-user-direct` para criar o usuario com:
- **Email:** `teste.whatsapp@gestaoebd.com`
- **Senha:** `mudar123`
- **Nome:** `Superintendente Teste`

### Passo 2 - Vincular ao cliente EBD
Atualizar o campo `superintendente_user_id` na tabela `ebd_clientes` com o ID do usuario criado. Isso fara o `DashboardRedirect` reconhecer o usuario como superintendente e redirecionar para `/ebd/dashboard`.

### Passo 3 - Criar perfil
A Edge Function ja cria o perfil automaticamente na tabela `profiles`.

## Resultado
Ao fazer login com `teste.whatsapp@gestaoebd.com` / `mudar123`, o usuario sera redirecionado automaticamente para o painel do superintendente (`/ebd/dashboard`) onde tera acesso a todas as funcoes: turmas, professores, alunos, frequencia, pedidos, etc.

## Secao Tecnica

### Chamadas necessarias

1. **Chamar Edge Function** `create-auth-user-direct`:
```json
{
  "email": "teste.whatsapp@gestaoebd.com",
  "password": "mudar123",
  "full_name": "Superintendente Teste"
}
```

2. **Atualizar `ebd_clientes`** (via SQL insert tool):
```sql
UPDATE ebd_clientes 
SET superintendente_user_id = '<user_id_retornado>'
WHERE id = '9a1b4214-18a4-4311-84a7-c248bac2e24a';
```

Nenhuma alteracao de codigo e necessaria -- apenas dados no banco.

