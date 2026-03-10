

## Plano: Landing Page Personalizada de Campanha com Rastreamento

Este é um projeto grande. Recomendo implementar em **3 fases** para manter a qualidade e evitar problemas. Apresento aqui a Fase 1 completa (tabelas + landing page + rastreamento) e a Fase 2 (dashboard admin + geração de links em lote).

---

### Fase 1 — Banco de Dados + Landing Page Dinâmica

#### 1. Tabelas no banco de dados (migração)

Vamos criar 2 tabelas novas (a tabela `whatsapp_campanhas` já existe e será reutilizada):

**`campaign_links`** — links únicos por cliente/campanha
- `id`, `token` (unique), `campaign_id` (FK para `whatsapp_campanhas`), `customer_name`, `customer_email`, `customer_phone`, `last_order_date`, `last_products` (text[]), `last_order_value`, `has_discount`, `discount_percentage`, `final_discount`, `access_email`, `access_password`, `panel_url`, `first_accessed_at`, `created_at`
- RLS: leitura pública (a página é acessada sem login)

**`campaign_events`** — rastreamento de eventos
- `id`, `link_id` (FK para `campaign_links`), `campaign_id`, `event_type` (enum: page_viewed, panel_accessed, purchase_completed), `event_data` (jsonb), `ip_address`, `user_agent`, `created_at`
- RLS: inserção pública (eventos são registrados sem login), leitura para admins

Também adicionaremos colunas à `whatsapp_campanhas`:
- `total_link_clicks` (int default 0)
- `total_page_views` (int default 0)
- `total_panel_accesses` (int default 0)
- `total_purchases` (int default 0)
- `total_revenue` (numeric default 0)

#### 2. Rota `/oferta/:token` — Landing Page Personalizada

**Arquivo novo: `src/pages/OfertaPersonalizada.tsx`**

Ao carregar:
1. Busca dados do cliente pelo `token` na `campaign_links`
2. Se token inválido/não encontrado → página "Oferta encerrada"
3. Se válido → registra evento `page_viewed` e marca `first_accessed_at` (se primeiro acesso)
4. Renderiza página personalizada com dados do cliente

**Design premium conforme especificação:**
- Header com logo Central Gospel
- Hero personalizado: "Olá, {nome}" com data da última compra
- 3 benefícios com reveal progressivo (desconto personalizado, frete grátis, Gestão EBD)
- Histórico: produtos da última compra em cards
- Dados de acesso ao painel (email + senha)
- Botão "Ver Minha Surpresa" → registra `panel_accessed` e redireciona
- Urgência + rodapé
- Botão WhatsApp flutuante
- Meta tags OG para preview no WhatsApp

**Rota no App.tsx:**
```
<Route path="/oferta/:token" element={<OfertaPersonalizada />} />
```

#### 3. Edge Function para registrar eventos

**`supabase/functions/campaign-track-event/index.ts`**
- POST com `{ token, event_type, event_data }`
- Sem autenticação (público)
- Insere na `campaign_events`
- Atualiza contadores na `whatsapp_campanhas`

---

### Fase 2 — Dashboard Admin + Geração de Links

#### 4. Geração de links em lote

**`supabase/functions/campaign-generate-links/index.ts`**
- Recebe `campaign_id` + lista de contatos do público selecionado
- Para cada contato: calcula desconto final, gera UUID token, insere em `campaign_links`
- Retorna lista de links gerados
- Lógica de desconto:
  - Sem desconto → 20%
  - Desconto < 30% → atual + 5%
  - Desconto >= 30% → mantém

#### 5. Dashboard de rastreamento

**Novo componente em `WhatsAppCampaigns.tsx`** (nova aba/step "tracking"):
- Cards de métricas: Enviados, Cliques, Acessos, Compras, Receita, Taxa de conversão
- Tabela de eventos por cliente
- Funil visual: Enviados → Clicaram → Acessaram → Compraram

#### 6. Integração com sistema de campanhas existente

- No step de template, adicionar variável `{{link_oferta}}` disponível
- Ao enviar campanha, gerar links automaticamente antes do disparo
- A `whatsapp-send-campaign` substituirá `{{link_oferta}}` pelo link único do destinatário

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/pages/OfertaPersonalizada.tsx` |
| Criar | `supabase/functions/campaign-track-event/index.ts` |
| Criar | `supabase/functions/campaign-generate-links/index.ts` |
| Editar | `src/App.tsx` (nova rota) |
| Editar | `src/components/admin/WhatsAppCampaigns.tsx` (dashboard tracking + geração de links) |
| Editar | `supabase/functions/whatsapp-send-campaign/index.ts` (integrar link_oferta) |
| Migração | 2 tabelas novas + colunas extras em `whatsapp_campanhas` |

### Observação sobre escopo

Este é um projeto extenso. Sugiro implementar a **Fase 1** primeiro (tabelas + landing page + rastreamento de eventos) para validar o design e o fluxo, e depois a **Fase 2** (dashboard + geração em lote + integração com envio).

