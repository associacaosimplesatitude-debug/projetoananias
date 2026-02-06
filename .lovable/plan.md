

# Deploy Automático de Edge Functions via GitHub Actions

## Visão Geral

Criar um workflow de GitHub Actions que faça deploy automático e healthcheck das Edge Functions críticas do Supabase, garantindo que nunca mais fiquem em estado 404.

---

## Arquitetura do Workflow

```text
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions                              │
├─────────────────────────────────────────────────────────────────┤
│  Trigger: push to main + paths: supabase/functions/**           │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Job 1: deploy-critical-functions                       │   │
│  │  ├── Checkout código                                    │   │
│  │  ├── Setup Supabase CLI                                 │   │
│  │  ├── Link ao projeto                                    │   │
│  │  └── Deploy 10 funções críticas (sequencial)            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Job 2: healthcheck                                     │   │
│  │  ├── Aguardar 10s (propagação)                          │   │
│  │  ├── OPTIONS em todas as 10 funções → espera 200        │   │
│  │  └── POST de teste (aceita 200/400/401, rejeita 404)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓                                      │
│  Se deploy falha → Workflow falha + log indica qual quebrou     │
│  Se healthcheck falha → Workflow falha + log indica qual 404    │
│  Se tudo OK → Workflow sucesso ✅                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Funções Críticas (10 total)

| Função | verify_jwt | Tipo de Teste |
|--------|------------|---------------|
| `api-bling` | true | OPTIONS → 200, POST → 401 |
| `mp-checkout-init` | false | OPTIONS → 200, POST → 400 |
| `calculate-shipping` | false | OPTIONS → 200, POST → 400 |
| `mp-create-order-and-pay` | false | OPTIONS → 200, POST → 400 |
| `mercadopago-webhook` | false | OPTIONS → 200, POST → 200/400 |
| `create-mercadopago-payment` | true | OPTIONS → 200, POST → 401 |
| `aprovar-faturamento` | true | OPTIONS → 200, POST → 401 |
| `bling-generate-nfe` | true | OPTIONS → 200, POST → 401 |
| `shopify-storefront-products` | false | OPTIONS → 200, POST → 200/400 |
| `ebd-shopify-order-webhook` | false | OPTIONS → 200, POST → 200/400 |

---

## Arquivo a Criar

| Arquivo | Descrição |
|---------|-----------|
| `.github/workflows/supabase-edge-functions-deploy.yml` | Workflow principal |

---

## Conteúdo Completo do Workflow

```yaml
name: Deploy Supabase Edge Functions

on:
  push:
    branches:
      - main
    paths:
      - 'supabase/functions/**'
  workflow_dispatch:  # Permite execução manual

env:
  SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
  SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

jobs:
  deploy-critical-functions:
    name: Deploy Critical Edge Functions
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Supabase project
        run: |
          supabase link --project-ref $SUPABASE_PROJECT_REF

      - name: Deploy critical functions
        run: |
          echo "🚀 Iniciando deploy das Edge Functions críticas..."
          
          CRITICAL_FUNCTIONS=(
            "api-bling"
            "mp-checkout-init"
            "calculate-shipping"
            "mp-create-order-and-pay"
            "mercadopago-webhook"
            "create-mercadopago-payment"
            "aprovar-faturamento"
            "bling-generate-nfe"
            "shopify-storefront-products"
            "ebd-shopify-order-webhook"
          )
          
          FAILED=()
          SUCCESS=()
          
          for fn in "${CRITICAL_FUNCTIONS[@]}"; do
            echo ""
            echo "📦 Deployando: $fn"
            echo "----------------------------------------"
            
            if supabase functions deploy "$fn" --project-ref $SUPABASE_PROJECT_REF; then
              echo "✅ $fn - Deploy OK"
              SUCCESS+=("$fn")
            else
              echo "❌ $fn - Deploy FALHOU"
              FAILED+=("$fn")
            fi
          done
          
          echo ""
          echo "========================================="
          echo "📊 RESUMO DO DEPLOY"
          echo "========================================="
          echo "✅ Sucesso: ${#SUCCESS[@]} funções"
          for fn in "${SUCCESS[@]}"; do echo "   - $fn"; done
          echo ""
          
          if [ ${#FAILED[@]} -gt 0 ]; then
            echo "❌ FALHAS: ${#FAILED[@]} funções"
            for fn in "${FAILED[@]}"; do echo "   - $fn"; done
            echo ""
            echo "🔴 WORKFLOW FALHOU - Corrija os erros acima"
            exit 1
          fi
          
          echo "🎉 Todas as funções críticas deployadas com sucesso!"

  healthcheck:
    name: Healthcheck Edge Functions
    runs-on: ubuntu-latest
    needs: deploy-critical-functions
    
    steps:
      - name: Wait for propagation
        run: sleep 10

      - name: Healthcheck - OPTIONS requests
        run: |
          echo "🔍 Verificando disponibilidade via OPTIONS..."
          
          BASE_URL="https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1"
          
          CRITICAL_FUNCTIONS=(
            "api-bling"
            "mp-checkout-init"
            "calculate-shipping"
            "mp-create-order-and-pay"
            "mercadopago-webhook"
            "create-mercadopago-payment"
            "aprovar-faturamento"
            "bling-generate-nfe"
            "shopify-storefront-products"
            "ebd-shopify-order-webhook"
          )
          
          ALL_OK=true
          
          for fn in "${CRITICAL_FUNCTIONS[@]}"; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              -X OPTIONS \
              -H "Origin: https://gestaoebd.com.br" \
              -H "Access-Control-Request-Method: POST" \
              "$BASE_URL/$fn")
            
            if [ "$STATUS" == "200" ]; then
              echo "✅ $fn: OPTIONS → $STATUS"
            elif [ "$STATUS" == "404" ]; then
              echo "❌ $fn: OPTIONS → 404 NOT_FOUND - FUNÇÃO NÃO DEPLOYADA!"
              ALL_OK=false
            else
              echo "⚠️ $fn: OPTIONS → $STATUS (esperado 200)"
            fi
          done
          
          if [ "$ALL_OK" = false ]; then
            echo ""
            echo "🔴 HEALTHCHECK FALHOU - Algumas funções retornaram 404!"
            exit 1
          fi
          
          echo ""
          echo "✅ Todas as funções responderam ao OPTIONS"

      - name: Healthcheck - POST requests (verify not 404)
        run: |
          echo "🔍 Verificando POST (aceita 200/400/401, rejeita 404)..."
          
          BASE_URL="https://${{ secrets.SUPABASE_PROJECT_REF }}.supabase.co/functions/v1"
          
          CRITICAL_FUNCTIONS=(
            "api-bling"
            "mp-checkout-init"
            "calculate-shipping"
            "mp-create-order-and-pay"
            "mercadopago-webhook"
            "create-mercadopago-payment"
            "aprovar-faturamento"
            "bling-generate-nfe"
            "shopify-storefront-products"
            "ebd-shopify-order-webhook"
          )
          
          ALL_OK=true
          
          for fn in "${CRITICAL_FUNCTIONS[@]}"; do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
              -X POST \
              -H "Content-Type: application/json" \
              -H "Origin: https://gestaoebd.com.br" \
              -d '{}' \
              "$BASE_URL/$fn")
            
            if [ "$STATUS" == "404" ]; then
              echo "❌ $fn: POST → 404 NOT_FOUND - FUNÇÃO NÃO EXISTE!"
              ALL_OK=false
            elif [ "$STATUS" == "200" ] || [ "$STATUS" == "400" ] || [ "$STATUS" == "401" ] || [ "$STATUS" == "403" ]; then
              echo "✅ $fn: POST → $STATUS (função ativa)"
            else
              echo "⚠️ $fn: POST → $STATUS (inesperado, mas não é 404)"
            fi
          done
          
          if [ "$ALL_OK" = false ]; then
            echo ""
            echo "🔴 HEALTHCHECK FALHOU - Algumas funções retornaram 404!"
            exit 1
          fi
          
          echo ""
          echo "🎉 Healthcheck completo - Todas as funções estão ativas!"
```

---

## Secrets Necessários no GitHub

Configure em: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Valor | Onde obter |
|--------|-------|------------|
| `SUPABASE_ACCESS_TOKEN` | Token de acesso pessoal | supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | `nccyrvfnvjngfyfvgnww` | ID do projeto (já conhecido) |

**Nota:** `SUPABASE_DB_PASSWORD` **NÃO é necessário** para deploy de Edge Functions.

---

## Comandos Usados no Workflow

| Comando | Propósito |
|---------|-----------|
| `supabase link --project-ref $REF` | Conecta CLI ao projeto |
| `supabase functions deploy $fn --project-ref $REF` | Deploya uma função específica |
| `curl -X OPTIONS -H "Origin: ..." $URL` | Testa preflight CORS |
| `curl -X POST -H "Content-Type: ..." -d '{}' $URL` | Testa se função responde |

---

## Como Validar no GitHub

1. **Após merge na main com mudanças em `supabase/functions/`**:
   - Acesse **Actions** no repositório
   - Verifique o workflow "Deploy Supabase Edge Functions"
   - O job `deploy-critical-functions` deve mostrar ✅ verde
   - O job `healthcheck` deve mostrar ✅ verde

2. **Execução manual (para teste)**:
   - Acesse **Actions → Deploy Supabase Edge Functions**
   - Clique em **Run workflow** → **Run workflow**

3. **Em caso de falha**:
   - Clique no job que falhou
   - Expanda o step com ❌
   - O log indica **exatamente qual função falhou**

---

## Critérios de Sucesso

| Verificação | Esperado |
|-------------|----------|
| Workflow dispara em push com mudanças em functions | ✅ |
| Deploy das 10 funções críticas | ✅ |
| OPTIONS retorna 200 para todas | ✅ |
| POST não retorna 404 para nenhuma | ✅ |
| Log indica qual função falhou (se falhar) | ✅ |

---

## Benefícios

| Benefício | Descrição |
|-----------|-----------|
| 🔄 **Automação** | Deploy automático a cada push relevante |
| ✅ **Healthcheck** | Verifica OPTIONS e POST após deploy |
| 🚨 **Alertas claros** | Log indica qual função falhou |
| 🛡️ **Prevenção de 404** | Garante que funções críticas estão sempre ativas |
| 🔧 **Execução manual** | `workflow_dispatch` permite rodar a qualquer momento |

