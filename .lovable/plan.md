

# Painel Google Ads no Admin Geral

## O que sera feito

### 1. Adicionar credenciais Google Ads na pagina de Integracoes

A pagina `/admin/ebd/integracoes` (VendedorIntegracoes.tsx) ja gerencia credenciais Z-API via tabela `system_settings`. Vamos adicionar um segundo card nessa mesma pagina para as 5 credenciais do Google Ads:

- **Developer Token** (campo com mascara de senha)
- **Client ID** (campo texto)
- **Client Secret** (campo com mascara de senha)
- **Refresh Token** (campo com mascara de senha)
- **Customer ID** (campo texto, ex: 6403318992)

Cada credencial sera salva como uma linha na tabela `system_settings` com as chaves:
`google_ads_developer_token`, `google_ads_client_id`, `google_ads_client_secret`, `google_ads_refresh_token`, `google_ads_customer_id`

### 2. Criar Edge Function `google-ads-data`

Funcao backend que le as credenciais da `system_settings` e consulta a API REST do Google Ads (v18). Acoes:

- **metrics** - Conversoes, cliques, CPC medio, custo (com filtro de datas)
- **balance** - Saldo/fundos disponiveis da conta
- **invoices** - Lista de documentos fiscais com links para download

### 3. Criar pagina GoogleAdsPanel.tsx

Nova pagina em `/admin/google-ads` (dentro do Admin Geral) com:

- Cards de metricas (Conversao, Cliques, CPC, Custo)
- Card de saldo com alerta de saldo baixo
- Botao "Adicionar Fundos" (abre pagina de billing do Google Ads)
- Tabela de documentos/notas fiscais com botao de download
- Filtro de periodo (data inicio/fim)

### 4. Adicionar rota e menu

- Nova rota `/admin/google-ads` no App.tsx dentro do bloco Admin Geral
- Novo item "Google Ads" no sidebar do AdminLayout.tsx (secao Configuracoes)

## Detalhes tecnicos

**Arquivos a criar:**
- `supabase/functions/google-ads-data/index.ts` - Edge Function
- `src/pages/admin/GoogleAdsPanel.tsx` - Pagina do painel

**Arquivos a modificar:**
- `src/pages/vendedor/VendedorIntegracoes.tsx` - Adicionar card de credenciais Google Ads
- `src/components/admin/AdminLayout.tsx` - Adicionar item no menu lateral
- `src/App.tsx` - Adicionar rota `/admin/google-ads`

**Padrao seguido:** Mesmo padrao da Z-API - credenciais na `system_settings`, lidas pela Edge Function com `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`.

