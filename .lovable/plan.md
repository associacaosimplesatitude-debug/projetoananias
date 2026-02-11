

# Corrigir exclusao de autor bloqueada por email logs

## Problema
A tabela `royalties_email_logs` possui uma foreign key para `royalties_autores` **sem** `ON DELETE CASCADE`. Todas as outras tabelas relacionadas ja possuem CASCADE configurado corretamente.

## Solucao
Alterar a constraint `royalties_email_logs_autor_id_fkey` para incluir `ON DELETE CASCADE`, permitindo que os logs de email sejam removidos automaticamente ao excluir um autor.

### Migracao SQL
```sql
ALTER TABLE royalties_email_logs
  DROP CONSTRAINT royalties_email_logs_autor_id_fkey;

ALTER TABLE royalties_email_logs
  ADD CONSTRAINT royalties_email_logs_autor_id_fkey
  FOREIGN KEY (autor_id) REFERENCES royalties_autores(id) ON DELETE CASCADE;
```

Nenhuma alteracao de codigo e necessaria. Apos a migracao, a exclusao de autores funcionara normalmente.

