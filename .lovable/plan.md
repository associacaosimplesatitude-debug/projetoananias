
# Plano: Adicionar CRON Job Diário para Sincronização de Royalties

## Objetivo
Manter o botão de sincronização manual e adicionar um CRON job que executa automaticamente uma vez por dia.

---

## Situação Atual

| Componente | Status |
|------------|--------|
| Edge Function `bling-sync-royalties-sales` | ✅ Existe e funciona |
| Botão "Sincronizar Bling" | ✅ Existe na página de Vendas |
| CRON Job automático | ❌ Não existe |

---

## Ações Necessárias

### 1. Criar CRON Job Diário

Adicionar um job que executa todos os dias as 6h da manha (horario de Brasilia):

```sql
SELECT cron.schedule(
  'royalties-sync-daily',
  '0 9 * * *',  -- 9h UTC = 6h Brasilia
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/bling-sync-royalties-sales',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body := '{"days_back": 7, "max_nfes": 100}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Configuracao do CRON

| Parametro | Valor | Motivo |
|-----------|-------|--------|
| Horario | 6h (Brasilia) | Antes do expediente |
| Frequencia | Diaria | Atualiza dados para o dia |
| `days_back` | 7 | Busca NFes dos ultimos 7 dias |
| `max_nfes` | 100 | Processa ate 100 NFes por execucao |

---

## Resultado Esperado

Apos a implementacao:
- ✅ Botao manual continua funcionando normalmente
- ✅ Dados sincronizados automaticamente todo dia as 6h
- ✅ Painel Admin e Portal do Autor atualizados automaticamente
- ✅ Menos dependencia de acao manual

---

## Secao Tecnica

### SQL para criar o CRON Job

```sql
-- Criar CRON job para sincronizar royalties diariamente
SELECT cron.schedule(
  'royalties-bling-sync-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nccyrvfnvjngfyfvgnww.supabase.co/functions/v1/bling-sync-royalties-sales',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jY3lydmZudmpuZ2Z5ZnZnbnd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NjMzNzQsImV4cCI6MjA3OTAzOTM3NH0.X7KFK1yGyeD0wqHQXCCLDqh9YBixDXYl9qNzwY6LXCI"}'::jsonb,
    body := '{"days_back": 7, "max_nfes": 100}'::jsonb
  ) AS request_id;
  $$
);
```

### Extensoes Necessarias

As extensoes `pg_cron` e `pg_net` ja estao habilitadas no projeto (varios CRONs ja existem).

### Lista de CRONs Existentes

O projeto ja possui CRONs para:
- `bling-sync-order-status-every-15min` (a cada 15 min)
- `bling-sync-stock-hourly` (a cada hora)
- `atualizar-comissao-status-diario` (6h diario)
- `sync-marketplace-orders` (a cada 30 min)
- E outros...

O novo CRON seguira o mesmo padrao.
