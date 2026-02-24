
# Modulo Google Ads -- 4 Paginas + Edge Function + Menu Lateral

## O que sera criado

```text
Menu lateral (AdminEBDLayout.tsx)
  |
  +-- Google (novo grupo, com submenu colapsavel)
       |-- Dashboard       (/admin/ebd/google-ads)
       |-- Faturamento      (/admin/ebd/google-ads-faturamento)
       |-- Documentos       (/admin/ebd/google-ads-documentos)
       +-- Integracoes      (/admin/ebd/google-ads-integracoes)
```

## Ajustes solicitados (ja incorporados)

1. **Documentos/Invoices -- fallback**: Se a API nao retornar invoices, a pagina mostrara uma mensagem amigavel ("Nenhuma nota fiscal encontrada para esta conta") com link direto para o painel de faturamento do Google Ads.

2. **Customer ID correto**: Todas as chamadas usarao o `google_ads_customer_id` (conta anunciante, ex: 6403318992) como parametro `customers/{customerId}`, nunca o MCC.

3. **Suporte a MCC**: Novo campo opcional `google_ads_login_customer_id` na tela de Integracoes. Quando preenchido, a Edge Function enviara o header `login-customer-id` nas chamadas a API do Google Ads, permitindo gerenciar contas via MCC.

## Detalhes tecnicos

### 1. Edge Function: `google-ads-dashboard`

**Arquivo:** `supabase/functions/google-ads-dashboard/index.ts`

Acoes suportadas:
- `validate` -- testa credenciais e retorna status
- `metrics` -- busca metricas via GAQL (conversions_value, clicks, average_cpc, cost_micros)
- `billing` -- busca resumo de faturamento (billing setup)
- `invoices` -- busca notas fiscais

Fluxo:
1. Valida autorizacao do usuario
2. Le credenciais de `system_settings` (incluindo `google_ads_login_customer_id` opcional)
3. Obtem `access_token` via OAuth2 refresh
4. Faz chamadas a `googleads.googleapis.com/v23/customers/{customerId}`
5. Se `login_customer_id` existir, adiciona header `login-customer-id`
6. Retorna dados formatados ou erro estruturado

### 2. Pagina Integracoes

**Arquivo:** `src/pages/admin/GoogleAdsIntegracoes.tsx`

- 6 campos: Developer Token, Client ID, Client Secret, Refresh Token, Customer ID, Login Customer ID (MCC - opcional)
- Toggle mostrar/ocultar para campos sensiveis
- Botao "Salvar Credenciais" com toast de confirmacao ou erro
- Botao "Testar Conexao" com status visual (verde/vermelho/amarelo)
- Segue padrao do `VendedorIntegracoes.tsx` para salvar na `system_settings`

### 3. Pagina Dashboard

**Arquivo:** `src/pages/admin/GoogleAdsDashboard.tsx`

- 4 scorecards: Valor Conversao (azul), Cliques (vermelho), CPC Medio (cinza), Custo (cinza)
- Filtros de periodo: Hoje, Ontem, 7 dias, 30 dias, Mes atual, Personalizado
- Conversao de `cost_micros` dividindo por 1.000.000
- Carrega dados automaticamente ao abrir

### 4. Pagina Faturamento

**Arquivo:** `src/pages/admin/GoogleAdsFaturamento.tsx`

- Cards com fundos disponiveis, ultimo pagamento, custo liquido, pagamentos do mes
- Botao "Adicionar Fundos" redireciona para pagina de faturamento do Google Ads (nova aba)

### 5. Pagina Documentos

**Arquivo:** `src/pages/admin/GoogleAdsDocumentos.tsx`

- Tabela: Data, Numero, Valor, Baixar PDF
- Filtros: Mes, Ano, Personalizado
- **Fallback**: Se API nao retornar invoices, mostra card com mensagem e link para o Google Ads
- Botao "Baixar selecionadas"

### 6. Alteracoes em arquivos existentes

**`AdminEBDLayout.tsx`:** Novo grupo "Google" no sidebar com submenu colapsavel e 4 sub-itens. Visivel apenas para admin e gerente_ebd.

**`App.tsx`:** 4 novas rotas lazy dentro do bloco `/admin/ebd`:
- `google-ads` -> GoogleAdsDashboard
- `google-ads-faturamento` -> GoogleAdsFaturamento
- `google-ads-documentos` -> GoogleAdsDocumentos
- `google-ads-integracoes` -> GoogleAdsIntegracoes

## Arquivos a criar (5)

1. `src/pages/admin/GoogleAdsIntegracoes.tsx`
2. `src/pages/admin/GoogleAdsDashboard.tsx`
3. `src/pages/admin/GoogleAdsFaturamento.tsx`
4. `src/pages/admin/GoogleAdsDocumentos.tsx`
5. `supabase/functions/google-ads-dashboard/index.ts`

## Arquivos a editar (2)

1. `src/components/admin/AdminEBDLayout.tsx`
2. `src/App.tsx`

## Nenhuma migracao SQL necessaria

A tabela `system_settings` ja existe com RLS para admin/gerente_ebd, e as credenciais do Google Ads ja estao cadastradas nela.
