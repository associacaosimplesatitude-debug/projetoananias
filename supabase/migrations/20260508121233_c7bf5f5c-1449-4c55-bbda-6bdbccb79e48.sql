-- Cleanup legado Shopify: arquivar tabelas históricas, marcar tabelas vivas, criar view consolidada e adicionar origem_venda

-- 1. Coluna 'arquivada' nas tabelas Shopify históricas/híbridas
ALTER TABLE public.ebd_shopify_pedidos_cg ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT true;
ALTER TABLE public.ebd_shopify_pedidos_cg_itens ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT true;
ALTER TABLE public.ebd_shopify_pedidos_itens ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT true;
ALTER TABLE public.ebd_shopify_pedidos ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;
ALTER TABLE public.ebd_shopify_pedidos_mercadopago ADD COLUMN IF NOT EXISTS arquivada boolean NOT NULL DEFAULT false;

-- 2. Comentários explícitos sobre o estado de cada tabela
COMMENT ON TABLE public.ebd_shopify_pedidos_cg IS
  'HISTÓRICO Shopify Central Gospel (loja cancelada em 04/2026). Não escrever novos registros. Pedidos novos vão em ebd_loja_pedidos_cg.';
COMMENT ON TABLE public.ebd_shopify_pedidos_cg_itens IS
  'HISTÓRICO itens Shopify CG (loja cancelada em 04/2026). Não escrever novos registros.';
COMMENT ON TABLE public.ebd_shopify_pedidos_itens IS
  'HISTÓRICO itens Shopify EBD (loja cancelada em 04/2026). Não escrever novos registros.';
COMMENT ON TABLE public.ebd_shopify_pedidos IS
  'USO HÍBRIDO: (1) histórico Shopify EBD (cancelada 04/2026) e (2) shadow records BLING- prefixados criados por sync-comissoes-faturado para metas Faturamento Direto. Para pedidos e-commerce novos, usar ebd_loja_pedidos_cg.';
COMMENT ON TABLE public.ebd_shopify_pedidos_mercadopago IS
  'TABELA ATIVA — canal Mercado Pago standalone (Pix/cartão direto). Apesar do prefixo shopify, NÃO é histórica: recebe escritas via mp-create-order-and-pay e mercadopago-webhook.';
COMMENT ON TABLE public.ebd_loja_pedidos_cg IS
  'TABELA ATIVA — Loja Central Gospel atual. Fonte canônica de pedidos e-commerce a partir de 04/2026. Escritas via receive-order-from-store-cg.';

-- 3. Coluna origem_venda em ebd_loja_pedidos_cg (futuro: agente IA)
ALTER TABLE public.ebd_loja_pedidos_cg ADD COLUMN IF NOT EXISTS origem_venda text;
COMMENT ON COLUMN public.ebd_loja_pedidos_cg.origem_venda IS
  'Origem da venda: site_organico | google_ads | meta_ads | embaixadora | agente_ia | vendedor_humano | outro';
CREATE INDEX IF NOT EXISTS idx_ebd_loja_pedidos_cg_origem_venda ON public.ebd_loja_pedidos_cg(origem_venda);

-- 4. View consolidada 360 do cliente
CREATE OR REPLACE VIEW public.pedidos_cliente_360 AS
SELECT
  cliente_id,
  id::text                  AS pedido_id,
  'historico_shopify_ebd'   AS origem,
  arquivada                 AS arquivado,
  created_at                AS data_pedido,
  status_pagamento,
  valor_total,
  customer_email            AS email,
  customer_phone            AS telefone
FROM public.ebd_shopify_pedidos
UNION ALL
SELECT
  cliente_id, id::text, 'historico_shopify_cg', arquivada,
  created_at, status_pagamento, valor_total,
  customer_email, NULL::text
FROM public.ebd_shopify_pedidos_cg
UNION ALL
SELECT
  cliente_id, id::text, 'mp_standalone_ativo', arquivada,
  created_at, status, valor_total,
  cliente_email, cliente_telefone
FROM public.ebd_shopify_pedidos_mercadopago
UNION ALL
SELECT
  cliente_id, id::text, 'loja_atual_cg', false,
  created_at, status_pagamento, valor_total,
  customer_email, customer_phone
FROM public.ebd_loja_pedidos_cg;

COMMENT ON VIEW public.pedidos_cliente_360 IS
  'View consolidada de pedidos do cliente em todas as fontes (4 tabelas). Coluna origem identifica fonte; arquivado=true indica registro histórico de loja Shopify cancelada.';

-- 5. Documentar fluxos canônicos de criação de cliente
COMMENT ON TABLE public.ebd_clientes IS
  'Tabela canônica de clientes. Criação válida via 3 Edge Functions, cada uma com escopo distinto: (1) create-client = admin form genérico; (2) create-ebd-user = vincular auth.user a cliente EBD existente (superintendente); (3) ebd-instant-signup = auto-cadastro público landing EBD. Não criar nova função sem revisar essas 3.';