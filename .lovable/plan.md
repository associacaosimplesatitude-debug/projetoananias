

## Problema

O erro "new row violates row-level security policy" ocorre porque as políticas de storage e das tabelas `revistas_digitais` e `revista_licoes` só permitem acesso para usuários com role `admin`. O usuário logado provavelmente tem role `gerente_ebd`, que não passa na verificação `is_admin_geral()`.

## Solução

Criar uma migração SQL que:

1. Crie uma função `can_manage_revistas(uuid)` que retorna `true` se o usuário tem role `admin` OU `gerente_ebd`
2. Atualize as políticas de storage (INSERT e DELETE no bucket `revistas`) para usar essa nova função
3. Atualize as políticas das tabelas `revistas_digitais` e `revista_licoes` (FOR ALL) para usar a mesma função
4. Atualize também as políticas das tabelas de quiz (`revista_licao_quiz`) para consistência

### SQL resumido

```sql
CREATE FUNCTION can_manage_revistas(_user_id uuid) ...
  -- checks user_roles for 'admin' or 'gerente_ebd'

DROP POLICY "Admins can upload revistas files" ON storage.objects;
CREATE POLICY "Managers can upload revistas files" ... WITH CHECK (can_manage_revistas(auth.uid()));
-- Same for DELETE, and for revistas_digitais/revista_licoes FOR ALL policies
```

Nenhuma alteração de código — apenas políticas de banco de dados.

