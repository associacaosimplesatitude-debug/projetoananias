

## Plano: Sistema de Campanhas WhatsApp com Segmentação de Público e Funil de Conversão

### O que será construído
Uma nova aba **"Campanhas"** no painel WhatsApp (`/admin/ebd/whatsapp`) com fluxo em 3 etapas: segmentação de público, seleção de template aprovado, e funil de acompanhamento da campanha.

---

### Banco de Dados — 2 novas tabelas

**`whatsapp_campanhas`** — Armazena cada campanha criada
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| nome | text | Nome da campanha |
| status | text | rascunho, enviando, enviada, pausada |
| template_id | uuid FK → whatsapp_templates | Template aprovado selecionado |
| filtros_publico | jsonb | Critérios de segmentação salvos (período, tipo doc, canais) |
| total_publico | int | Qtd de destinatários |
| total_enviados | int | Qtd de mensagens entregues |
| total_erros | int | Qtd de erros de envio |
| created_by | uuid | Usuário que criou |
| created_at / updated_at | timestamptz | |

**`whatsapp_campanha_destinatarios`** — Cada destinatário individual da campanha
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| campanha_id | uuid FK → whatsapp_campanhas | |
| cliente_id | uuid FK → ebd_clientes (nullable) | |
| telefone | text | Telefone formatado |
| nome | text | Nome do destinatário |
| email | text | Email |
| tipo_documento | text | CPF ou CNPJ |
| status_envio | text | pendente, enviado, erro |
| enviado_em | timestamptz | |
| cliques_botoes | jsonb | Ex: `{"botao_1": true, "botao_2": false}` |
| visitou_link | boolean default false | |
| comprou | boolean default false | |
| valor_compra | numeric | Valor da compra pós-campanha |
| created_at | timestamptz | |

RLS: Acesso restrito a admin/gerente_ebd.

---

### Frontend — Nova aba "Campanhas" no WhatsAppPanel

**Etapa 1: Segmentação de Público**
- Filtros:
  - **Período da última compra** (ex: novembro 2025) — date range picker
  - **Tipo documento**: CPF, CNPJ ou Ambos
  - **Canais**: checkboxes para Shopify, Mercado Pago, Faturados B2B (propostas)
- Query cruza `ebd_shopify_pedidos` + `ebd_shopify_pedidos_mercadopago` + `vendedor_propostas` via `cliente_id` → `ebd_clientes` para obter telefone e tipo doc
- Exibe **quantidade do público** em destaque e lista prévia dos destinatários
- Botão "Próximo: Selecionar Template"

**Etapa 2: Seleção de Template**
- Lista apenas templates com `status = 'APPROVED'` da tabela `whatsapp_templates`
- Preview do template selecionado (estilo WhatsApp)
- Mostra os botões do template se houver
- Botão "Criar Campanha"

**Etapa 3: Funil da Campanha (Dashboard)**
- Lista de campanhas criadas com cards
- Ao clicar, abre o funil visual com barras/etapas:
  1. **Público Total** — total de destinatários
  2. **Mensagens Enviadas** — quantos receberam
  3. **Cliques por Botão** — se template tem N botões, mostra N barras separadas com nome e contagem
  4. **Visitaram a Página** — quem acessou o link do botão
  5. **Compraram** — quem fez compra após a campanha
  6. **Valor Total de Compras** — soma monetária

---

### Edge Function — `whatsapp-send-campaign`
- Recebe `campanha_id`, busca destinatários pendentes
- Para cada destinatário: monta payload com template Meta (variáveis preenchidas) e envia via Graph API
- Atualiza `status_envio` de cada destinatário
- Atualiza contadores na `whatsapp_campanhas`

---

### Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/admin/WhatsAppCampaigns.tsx` — componente completo (segmentação + template + funil) |
| Criar | `supabase/functions/whatsapp-send-campaign/index.ts` — envio em massa |
| Editar | `src/pages/admin/WhatsAppPanel.tsx` — adicionar aba "Campanhas" |
| Migração | 2 tabelas novas + RLS policies |

### Tracking de cliques/visitas
- Os botões do template Meta podem conter URLs com UTM params + `campanha_id` e `destinatario_id` para tracking
- O webhook existente (`whatsapp-webhook`) já recebe status de entrega que pode ser usado para atualizar `status_envio`
- Para visitas à LP, usaremos query params na URL do botão para identificar o destinatário

