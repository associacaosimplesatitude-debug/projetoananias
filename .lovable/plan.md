

# Plano: Gerar Script SQL Completo para Migrar o Banco de Dados

## Resumo

Vou gerar um arquivo SQL completo (`migration-script.sql`) contendo todo o schema do seu banco de dados atual, pronto para colar no SQL Editor de um Supabase externo. O arquivo incluira:

- **8 ENUMs** (app_role, church_permission, ebd_role, etc.)
- **110 tabelas** com todas as colunas, tipos, defaults e constraints
- **Todas as foreign keys** (chaves estrangeiras)
- **Todos os indices** customizados
- **RLS habilitado** em todas as tabelas
- **500+ RLS policies**
- **25+ database functions** (has_role, is_vendedor, etc.)
- **Triggers** associados

## Importante

- O script cria apenas a **estrutura** (schema), nao migra os **dados**. Para migrar dados, sera necessario fazer export/import separadamente.
- Foreign keys que referenciam `auth.users` serao mantidas, pois o Supabase externo ja possui essa tabela.
- O script sera organizado na ordem correta de dependencias (enums primeiro, depois tabelas sem FK, depois tabelas com FK).

## Estrutura do Arquivo

O script SQL sera dividido em seções:

1. **ENUMs** - Criacao dos tipos enum
2. **Tabelas** - CREATE TABLE em ordem de dependencia
3. **Indices** - CREATE INDEX para indices customizados
4. **RLS** - ALTER TABLE ENABLE RLS + todas as policies
5. **Functions** - Todas as database functions
6. **Triggers** - Todos os triggers associados

## Detalhes Tecnicos

- O arquivo sera criado em `docs/migration-script.sql` no projeto
- Tamanho estimado: ~3000-5000 linhas de SQL
- Compativel com Supabase SQL Editor (PostgreSQL 15+)
- Inclui `IF NOT EXISTS` onde possivel para seguranca

## Limitacoes

- **Storage buckets** e **Edge Functions** precisam ser recriados manualmente no novo Supabase
- **Secrets** (API keys) precisam ser reconfigurados
- **Dados** nao sao incluidos - apenas a estrutura
- **Auth users** precisam ser migrados separadamente

