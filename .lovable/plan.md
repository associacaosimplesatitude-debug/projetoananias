

# Configurar Cron Job para Sincronizacao Automatica Diaria

## O que ja esta pronto
- Botao "Sincronizar" com opcao de periodo personalizado (datas de inicio e fim)
- Edge function atualizada para aceitar datas customizadas
- Configuracao de seguranca ajustada para permitir chamadas automaticas

## O que falta
Executar o SQL no banco de dados para:

1. **Habilitar extensoes** `pg_cron` e `pg_net` (necessarias para agendar tarefas)
2. **Criar o agendamento** para rodar todos os dias as 00:00 (horario de Brasilia), sincronizando apenas os ultimos 2 dias de notas fiscais

## Detalhes Tecnicos

### SQL a ser executado
```text
-- Habilitar extensoes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Agendar sync diario as 00:00 Brasilia (03:00 UTC)
SELECT cron.schedule(
  'sync-royalties-sales-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/bling-sync-royalties-sales',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI"}'::jsonb,
    body := '{"days_back":2,"max_nfes":500}'::jsonb
  ) AS request_id;
  $$
);
```

### O que o cron faz
- Roda automaticamente todo dia as 00:00 (Brasilia)
- Busca apenas os ultimos 2 dias de notas fiscais (rapido, poucas NFes)
- Insere automaticamente as novas vendas na tabela de royalties
- Envia emails de notificacao para os autores quando ha novas vendas

### Resultado final
- Sincronizacao automatica diaria sem intervencao manual
- Botao manual continua disponivel para sincronizacoes sob demanda com periodo personalizado

