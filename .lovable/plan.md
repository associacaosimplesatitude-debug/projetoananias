

# Plano: Fluxo Venda Shopify → OTP WhatsApp → Leitura de Revista Digital

## Visão Geral

Criar um fluxo independente de acesso a revistas digitais para compradores diretos do Shopify, autenticados via OTP por WhatsApp (sem Supabase Auth). Totalmente separado do sistema existente de licenças por superintendente.

---

## Parte 1 — Banco de Dados (Migration)

Criar 2 tabelas novas com RLS:

- **`revista_licencas_shopify`** — licenças de compra direta (revista_id, shopify_order_id, whatsapp, nome_comprador, email, ativo, expira_em)
- **`revista_otp`** — códigos OTP temporários (whatsapp, codigo, expira_em, usado) + índice de lookup

RLS: `service_role` full access + admin select na tabela de licenças. Ambas com `ENABLE ROW LEVEL SECURITY`.

---

## Parte 2 — Edge Functions

### 2A. Atualizar `ebd-shopify-order-webhook`

Após toda a lógica existente (antes do `return` final, ~linha 997), adicionar bloco que:
1. Itera `order.line_items`, extrai SKU de cada item
2. Consulta `ebd_produto_revista_mapping` por SKU
3. Se encontrar mapeamento → cria registro em `revista_licencas_shopify`
4. Envia WhatsApp de boas-vindas com link `/revista/acesso` via `send-whatsapp-message`
5. Envia email via `send-ebd-email` se houver email

**Nota técnica**: O type `ShopifyOrder.line_items` atual não inclui `sku`. Será necessário adicionar `sku?: string` à interface.

### 2B. Criar `revista-solicitar-otp` (verify_jwt = false)

- Recebe `{ whatsapp }`, normaliza número
- Verifica licença ativa em `revista_licencas_shopify`
- Gera código 4 dígitos, salva em `revista_otp` (expira 10min)
- Envia código via `send-whatsapp-message`

### 2C. Criar `revista-validar-otp` (verify_jwt = false)

- Recebe `{ whatsapp, codigo }`
- Valida OTP não usado e não expirado
- Marca OTP como usado
- Retorna licenças ativas com dados da revista + token base64 (24h)

---

## Parte 3 — Frontend (Rotas Públicas)

### 3A. `/revista/acesso` — `RevistaAcesso.tsx`

Componente com 2 steps via state local:

**Step 1 (número)**: Input de telefone com máscara `(XX) XXXXX-XXXX`, botão grande "Enviar código pelo WhatsApp". Chama `revista-solicitar-otp`. Tratamento de erros amigável.

**Step 2 (código)**: 4 inputs separados (64×72px, font 36px), auto-focus entre campos. Botão "Entrar" chama `revista-validar-otp`. Timer de 60s para reenvio. Sucesso salva token + licenças em `sessionStorage` e redireciona para `/revista/leitura`.

Design para público idoso: fonte mínima 18px, botões 56px altura, contraste alto.

### 3B. `/revista/leitura` — `RevistaLeitura.tsx`

- Valida token do `sessionStorage` (redireciona se ausente/expirado)
- 1 licença: mostra capa + botão "Começar a leitura"
- Múltiplas: grid de cards com capa e título
- Ao clicar numa revista: lista lições (query a `ebd_licoes` onde `revista_id` = X)
- Botão "Sair" limpa session e volta para `/revista/acesso`

### 3C. Registrar rotas em `App.tsx`

Adicionar ambas como rotas públicas (sem `ProtectedRoute`).

---

## Parte 4 — Painel Admin

### Aba "Vendas Shopify" em `RevistaLicencasAdmin.tsx`

Adicionar sistema de abas (Tabs shadcn/ui):
- **Aba 1**: "Licenças Superintendente" (conteúdo atual, inalterado)
- **Aba 2**: "Vendas Shopify" (novo)

Conteúdo da aba Vendas Shopify:
- Tabela: Nome, WhatsApp, Email, Revista, Pedido, Data, Status
- Query via `save-system-settings` pattern (ou edge function dedicada) para ler `revista_licencas_shopify`
- Filtro por revista e status
- Botão "Adicionar licença manual" (modal)
- Botão "Reenviar acesso" por linha
- Botão "Desativar" por linha

**Nota**: Como RLS só permite service_role, as operações de leitura/escrita do admin serão feitas via a edge function `save-system-settings` ou uma nova edge function leve para queries admin.

---

## Arquivos Modificados/Criados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar 2 tabelas + RLS + índice |
| `supabase/functions/ebd-shopify-order-webhook/index.ts` | Adicionar bloco revista digital (~40 linhas antes do return final) |
| `supabase/functions/revista-solicitar-otp/index.ts` | Criar |
| `supabase/functions/revista-validar-otp/index.ts` | Criar |
| `src/pages/revista/RevistaAcesso.tsx` | Criar |
| `src/pages/revista/RevistaLeitura.tsx` | Criar |
| `src/App.tsx` | Adicionar 2 rotas públicas + imports |
| `src/pages/admin/RevistaLicencasAdmin.tsx` | Adicionar aba "Vendas Shopify" |

