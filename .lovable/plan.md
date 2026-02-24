
# Modulo Google (Financeiro) -- Notas Fiscais e Recargas PIX

## Visao Geral

Criar um novo modulo de gestao financeira do Google Ads dentro do sistema EBD. O fluxo e offline: Admin gera/baixa documentos no Google Ads e sobe no sistema; Financeiro acompanha e baixa. Sem integracao direta com API do Google Ads para notas/pagamentos.

Dois perfis: **Admin** (acesso total) e **Financeiro** (visualizacao + acoes limitadas).

## Estrutura de Rotas

```text
Admin EBD (sidebar existente):
  Google (grupo existente, adicionar 2 sub-itens)
    +-- Notas Fiscais    /admin/ebd/google/notas
    +-- Recargas (PIX)   /admin/ebd/google/recargas

(Os 4 sub-itens existentes de Google Ads permanecem)
```

O financeiro ja tem acesso ao AdminEBDLayout (rota `/admin/ebd` permite `allowFinanceiro`). Os novos itens de menu serao visiveis para admin e financeiro.

## Banco de Dados -- 2 Tabelas + 1 Bucket

### Tabela `google_ads_invoices`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| competencia_month | int | NOT NULL, 1-12 |
| competencia_year | int | NOT NULL |
| customer_id | text | NOT NULL |
| invoice_number | text | nullable |
| issue_date | date | nullable |
| amount | numeric(12,2) | nullable |
| currency | text | default 'BRL' |
| status | text | NOT NULL, default 'PENDENTE' |
| pdf_url | text | nullable |
| pdf_filename | text | nullable |
| notes | text | nullable |
| created_by | uuid | nullable |
| updated_by | uuid | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

Constraint UNIQUE: `(competencia_month, competencia_year, customer_id)`

Trigger: `updated_at = now()` on UPDATE.

### Tabela `google_ads_topups`

| Campo | Tipo | Detalhes |
|---|---|---|
| id | uuid PK | default gen_random_uuid() |
| customer_id | text | NOT NULL |
| requested_by | uuid | NOT NULL |
| requested_amount | numeric(12,2) | NOT NULL |
| requested_at | timestamptz | default now() |
| cost_center | text | nullable |
| request_note | text | nullable |
| pix_code | text | nullable |
| pix_qr_url | text | nullable |
| pix_expires_at | timestamptz | nullable |
| provided_by | uuid | nullable |
| provided_at | timestamptz | nullable |
| paid_marked_by | uuid | nullable |
| paid_marked_at | timestamptz | nullable |
| payment_proof_url | text | nullable |
| payment_proof_filename | text | nullable |
| status | text | NOT NULL, default 'SOLICITADA' |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| updated_by | uuid | nullable |

Trigger: `updated_at = now()` on UPDATE.

### Storage Bucket: `google_docs`

Politicas:
- Admin pode INSERT e SELECT em qualquer path
- Financeiro pode SELECT em qualquer path e INSERT apenas em `topups/*/comprovante*`

### RLS

**google_ads_invoices:**
- Admin: ALL (select, insert, update, delete)
- Financeiro: SELECT only

**google_ads_topups:**
- Admin: ALL
- Financeiro: SELECT all; INSERT (criar solicitacao); UPDATE restrito (apenas campos `paid_marked_by`, `paid_marked_at`, `payment_proof_url`, `payment_proof_filename`, `status` e somente quando status anterior permite)

Helper function `is_admin_geral(uid)` retorna true se role = 'admin'.
Helper function `is_financeiro(uid)` retorna true se role in ('admin', 'financeiro').

## Arquivos a Criar (4)

### 1. `src/pages/admin/GoogleNotasFiscais.tsx`

Pagina unificada para Admin e Financeiro. Detecta role via `useAuth()`.

**Financeiro ve:**
- Tabela com competencia, valor, status (badge colorido), botao Baixar PDF (quando GERADA)
- Quando PENDENTE: texto "Aguardando anexo do Admin"
- Filtros: Ano, Mes
- Botao "Solicitar Nota" (gera toast e pode criar notificacao simples)

**Admin ve tudo acima +:**
- Botao "Upload Nota Fiscal" (abre modal com: numero da nota, data emissao, valor, upload PDF, observacao)
- Botao "Aprovar e Liberar" (muda status para GERADA)
- Botao "Substituir arquivo"
- Botao "Criar pendencia do mes atual" (cria registro PENDENTE para o customer_id configurado)

### 2. `src/pages/admin/GoogleRecargas.tsx`

Pagina unificada para Admin e Financeiro.

**Financeiro ve:**
- Botao "Solicitar Recarga" no topo (modal: valor, centro de custo, observacao)
- Tabela: data, valor, status, acoes
- Quando PIX_DISPONIVEL: mostrar pix_code (mascarado com botao mostrar), botao "Copiar PIX", botao "Marcar como Pago" (com upload de comprovante opcional)
- Quando PAGO_EM_CONFERENCIA: "Aguardando confirmacao do Admin"
- Quando CONFIRMADO: ver historico

**Admin ve tudo acima +:**
- Quando AGUARDANDO_CODIGO_PIX: botao "Inserir PIX" (modal: pix_code, expiracao, upload QR)
- Quando PAGO_EM_CONFERENCIA: botao "Confirmar"
- Botao "Cancelar"
- Filtros: status, periodo, customer_id

### 3. `src/components/google/InvoiceUploadModal.tsx`

Modal reutilizavel para upload de nota fiscal (campos: numero, data, valor, arquivo PDF, observacao). Faz upload para storage bucket `google_docs` no path `invoices/{customer_id}/{year}-{month}/`.

### 4. `src/components/google/TopupPixModal.tsx`

Modal reutilizavel para inserir codigo PIX (campos: pix_code, expiracao, upload QR opcional).

## Arquivos a Editar (2)

### `src/components/admin/AdminEBDLayout.tsx`

No grupo "Google" existente (linhas 440-504), adicionar 2 novos sub-itens dentro do Collapsible:
- "Notas Fiscais" -> `/admin/ebd/google/notas` (icone FileText)
- "Recargas (PIX)" -> `/admin/ebd/google/recargas` (icone Wallet)

Remover a condicao `!isFinanceiro` do grupo Google para que o financeiro tambem veja o menu. Os sub-itens de Google Ads (Dashboard, Faturamento, Documentos, Integracoes) continuam visiveis apenas para admin/gerente_ebd dentro do submenu, controlados por condicional no render.

Atualizar o estado `googleOpen` para tambem detectar `/admin/ebd/google/`.

### `src/App.tsx`

Adicionar imports e 2 novas rotas dentro do bloco `/admin/ebd`:
- `google/notas` -> GoogleNotasFiscais
- `google/recargas` -> GoogleRecargas

## Migracao SQL

Uma unica migracao com:
1. CREATE TABLE `google_ads_invoices` com constraint UNIQUE
2. CREATE TABLE `google_ads_topups`
3. Triggers de `updated_at` para ambas
4. Helper functions `is_admin_geral` e `is_financeiro_or_admin`
5. RLS policies para ambas as tabelas
6. CREATE storage bucket `google_docs`
7. Storage policies

## Fluxo de Status

### Notas Fiscais
```text
PENDENTE -> EM_VALIDACAO (Admin faz upload) -> GERADA (Admin aprova)
                                             -> SUBSTITUIDA (Admin substitui arquivo)
                                             -> CANCELADA
```

### Recargas
```text
SOLICITADA -> AGUARDANDO_CODIGO_PIX (automatico ao criar)
           -> PIX_DISPONIVEL (Admin insere PIX)
           -> AGUARDANDO_PAGAMENTO
           -> PAGO_EM_CONFERENCIA (Financeiro marca como pago)
           -> CONFIRMADO (Admin confirma)
           -> CANCELADO / EXPIRADO
```

## Seguranca

- Upload de PDF e insercao de PIX: apenas Admin (verificado via role no frontend + RLS no backend)
- Financeiro pode apenas: criar solicitacao de recarga, marcar como pago, anexar comprovante, baixar PDFs liberados
- Todas as acoes registram `created_by`/`updated_by` para auditoria
- Storage bucket com politicas especificas por role
