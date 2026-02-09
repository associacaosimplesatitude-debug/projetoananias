
# Painel de Emails Enviados

## Resumo

Melhorar a aba "Historico" existente na pagina de Emails (`/royalties/emails`) transformando-a em um painel completo com:

- Cards de resumo no topo (total enviados, erros, taxa de sucesso)
- Indicacao se o envio foi automatico ou manual
- Tabela melhorada com filtros e detalhes expandiveis
- Coluna de tipo (automatico/manual) baseada nos dados enviados

## Problema atual

A tabela `royalties_email_logs` nao possui um campo para diferenciar envios automaticos de manuais, nem rastreamento de abertura de email. Precisaremos:

1. Adicionar coluna `tipo_envio` (automatico/manual) na tabela
2. Nota: rastreamento de abertura (open tracking) requer integracao com webhook do Resend - sera preparada a estrutura mas depende de configuracao adicional

## Alteracoes

### 1. Migracao SQL

Adicionar duas novas colunas na tabela `royalties_email_logs`:

- `tipo_envio` (TEXT, default 'manual') - valores: 'automatico' ou 'manual'
- `resend_email_id` (TEXT, nullable) - para futuro rastreamento de abertura via Resend webhooks

### 2. Atualizar Edge Function `send-royalties-email`

Aceitar novo campo `tipoEnvio` no request body e salvar no log. Tambem salvar o `emailId` retornado pelo Resend no campo `resend_email_id`.

### 3. Atualizar disparos automaticos

Nos arquivos `AffiliateLinkDialog.tsx` e `AutorDialog.tsx`, passar `tipoEnvio: "automatico"` no body da chamada a edge function.

### 4. Reescrever `EmailLogsTab.tsx` como painel completo

O componente sera transformado para incluir:

**Cards de Resumo (topo)**:
- Total de emails enviados
- Emails com sucesso
- Emails com erro  
- Taxa de sucesso (%)

**Filtros**:
- Busca por texto (destinatario, assunto, autor)
- Filtro por status (todos, enviado, erro)
- Filtro por tipo (todos, automatico, manual)
- Filtro por periodo (ultimos 7 dias, 30 dias, todos)

**Tabela melhorada**:
- Coluna "Tipo" com badge diferenciando automatico/manual
- Coluna "Data" com formatacao
- Coluna "Autor"
- Coluna "Destinatario"
- Coluna "Template"
- Coluna "Assunto"
- Coluna "Status" com badge colorido
- Linha expandivel com detalhes (dados enviados, erro se houver)

## Detalhes Tecnicos

### Arquivos alterados

| Arquivo | Acao |
|---------|------|
| Migracao SQL | Adicionar colunas `tipo_envio` e `resend_email_id` |
| `supabase/functions/send-royalties-email/index.ts` | Aceitar `tipoEnvio`, salvar `resend_email_id` |
| `src/components/royalties/AffiliateLinkDialog.tsx` | Passar `tipoEnvio: "automatico"` |
| `src/components/royalties/AutorDialog.tsx` | Passar `tipoEnvio: "automatico"` |
| `src/components/royalties/EmailLogsTab.tsx` | Reescrever como painel completo com cards e filtros |

### Estrutura do novo EmailLogsTab

```text
+--------------------------------------------------+
| [Total: 25]  [Sucesso: 23]  [Erro: 2]  [92%]   |
+--------------------------------------------------+
| [Busca...]  [Status: v]  [Tipo: v]  [Periodo: v] |
+--------------------------------------------------+
| Data | Tipo | Autor | Dest. | Template | Status  |
|------|------|-------|-------|----------|---------|
| ...  | Auto | ...   | ...   | ...      | OK      |
| ...  | Man. | ...   | ...   | ...      | Erro    |
+--------------------------------------------------+
```
