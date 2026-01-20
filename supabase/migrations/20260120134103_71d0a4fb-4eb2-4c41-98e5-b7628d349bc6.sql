-- FASE 1: Adicionar coluna vendedor_email na tabela de parcelas
ALTER TABLE public.vendedor_propostas_parcelas 
ADD COLUMN IF NOT EXISTS vendedor_email TEXT;

-- Criar índice para buscas por email
CREATE INDEX IF NOT EXISTS idx_parcelas_vendedor_email 
ON public.vendedor_propostas_parcelas(vendedor_email);

-- Backfill: Preencher com email do vendedor existente
UPDATE public.vendedor_propostas_parcelas vpp
SET vendedor_email = v.email
FROM public.vendedores v
WHERE vpp.vendedor_id = v.id
  AND vpp.vendedor_email IS NULL;

-- CORREÇÃO DO PEDIDO DE TESTE (R$ 5.841,05)
-- Primeiro inserir registro de meta
INSERT INTO public.ebd_shopify_pedidos (
  shopify_order_id, order_number, vendedor_id, cliente_id, 
  valor_total, valor_frete, valor_para_meta, status_pagamento,
  customer_name, order_date, bling_order_id
) 
SELECT 
  24878646004, 'BLING-24878646004', 
  '188e74fd-d90b-4dc5-9d2c-89b1fada1cfc'::uuid,
  'c69c7916-dbda-47da-8ab2-083f171cd427'::uuid,
  5841.05, 0, 5841.05, 'Faturado',
  'IGREJA TESTE FATURAMENTO', NOW(), 24878646004
WHERE NOT EXISTS (
  SELECT 1 FROM public.ebd_shopify_pedidos 
  WHERE bling_order_id = 24878646004 OR shopify_order_id = 24878646004
);

-- Inserir as 3 parcelas de comissão (60/90/120 dias) com cast explícito para UUID
INSERT INTO public.vendedor_propostas_parcelas (
  proposta_id, vendedor_id, cliente_id, 
  numero_parcela, total_parcelas, valor, valor_comissao,
  data_vencimento, status, origem, metodo_pagamento, 
  bling_order_id, vendedor_email
)
SELECT * FROM (
  VALUES 
    ('a9cbeade-f683-402d-8a15-c701bb5fa1e6'::uuid, 
     '188e74fd-d90b-4dc5-9d2c-89b1fada1cfc'::uuid,
     'c69c7916-dbda-47da-8ab2-083f171cd427'::uuid,
     1, 3, 1947.02::numeric, 29.21::numeric, 
     (CURRENT_DATE + 60)::date, 'aguardando', 'faturado', 'boleto_60', 
     24878646004::bigint, 'vendedorteste@gmail.com'),
    ('a9cbeade-f683-402d-8a15-c701bb5fa1e6'::uuid, 
     '188e74fd-d90b-4dc5-9d2c-89b1fada1cfc'::uuid,
     'c69c7916-dbda-47da-8ab2-083f171cd427'::uuid,
     2, 3, 1947.02::numeric, 29.21::numeric, 
     (CURRENT_DATE + 90)::date, 'aguardando', 'faturado', 'boleto_90', 
     24878646004::bigint, 'vendedorteste@gmail.com'),
    ('a9cbeade-f683-402d-8a15-c701bb5fa1e6'::uuid, 
     '188e74fd-d90b-4dc5-9d2c-89b1fada1cfc'::uuid,
     'c69c7916-dbda-47da-8ab2-083f171cd427'::uuid,
     3, 3, 1947.01::numeric, 29.20::numeric, 
     (CURRENT_DATE + 120)::date, 'aguardando', 'faturado', 'boleto_120', 
     24878646004::bigint, 'vendedorteste@gmail.com')
) AS t(proposta_id, vendedor_id, cliente_id, numero_parcela, total_parcelas, 
       valor, valor_comissao, data_vencimento, status, origem, metodo_pagamento, 
       bling_order_id, vendedor_email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.vendedor_propostas_parcelas 
  WHERE proposta_id = 'a9cbeade-f683-402d-8a15-c701bb5fa1e6'::uuid
);