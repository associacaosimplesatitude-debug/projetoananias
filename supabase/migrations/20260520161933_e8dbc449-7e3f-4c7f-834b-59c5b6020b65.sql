
-- 1) Função de normalização de telefone
CREATE OR REPLACE FUNCTION public.normalizar_telefone_whatsapp(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(input, '\D', '', 'g');
  IF d IS NULL OR length(d) = 0 THEN RETURN NULL; END IF;
  -- Remove DDI Brasil
  IF length(d) = 13 AND substring(d, 1, 2) = '55' THEN
    d := substring(d, 3);
  ELSIF length(d) = 12 AND substring(d, 1, 2) = '55' THEN
    d := substring(d, 3);
  END IF;
  IF length(d) < 10 OR length(d) > 11 THEN
    RETURN NULL;
  END IF;
  RETURN d;
END;
$$;

-- 2) Tabela whatsapp_optouts
CREATE TABLE IF NOT EXISTS public.whatsapp_optouts (
  telefone text PRIMARY KEY,
  motivo text NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  opted_out_via text NOT NULL CHECK (opted_out_via IN ('admin','auto_reply','webhook','import')),
  opted_out_by uuid NULL REFERENCES auth.users(id)
);

ALTER TABLE public.whatsapp_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can select optouts"
  ON public.whatsapp_optouts FOR SELECT
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins can insert optouts"
  ON public.whatsapp_optouts FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Superadmins can delete optouts"
  ON public.whatsapp_optouts FOR DELETE
  USING (public.has_role(auth.uid(), 'superadmin'::app_role));

-- 3) Colunas meta_message_id
ALTER TABLE public.whatsapp_campanha_destinatarios
  ADD COLUMN IF NOT EXISTS meta_message_id text NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_camp_dest_meta_message_id
  ON public.whatsapp_campanha_destinatarios(meta_message_id);

ALTER TABLE public.whatsapp_mensagens
  ADD COLUMN IF NOT EXISTS meta_message_id text NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_mensagens_meta_message_id
  ON public.whatsapp_mensagens(meta_message_id);

-- 4) Índices auxiliares para a view 360
CREATE INDEX IF NOT EXISTS idx_ebd_clientes_telefone
  ON public.ebd_clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_customer_phone
  ON public.ebd_shopify_pedidos(customer_phone);
CREATE INDEX IF NOT EXISTS idx_ebd_shopify_pedidos_cg_endereco_telefone
  ON public.ebd_shopify_pedidos_cg(endereco_telefone);
CREATE INDEX IF NOT EXISTS idx_ebd_loja_pedidos_cg_customer_phone
  ON public.ebd_loja_pedidos_cg(customer_phone);
CREATE INDEX IF NOT EXISTS idx_ebd_pedidos_telefone_cliente
  ON public.ebd_pedidos(telefone_cliente);
CREATE INDEX IF NOT EXISTS idx_revista_licencas_shopify_whatsapp
  ON public.revista_licencas_shopify(whatsapp);

-- 5) View whatsapp_contatos_360
CREATE OR REPLACE VIEW public.whatsapp_contatos_360 AS
WITH
  -- ebd_clientes
  src_clientes AS (
    SELECT
      public.normalizar_telefone_whatsapp(telefone) AS telefone,
      id AS cliente_id,
      nome_superintendente AS nome,
      email_superintendente AS email,
      tipo_cliente,
      possui_cnpj
    FROM public.ebd_clientes
    WHERE telefone IS NOT NULL
  ),
  clientes AS (
    SELECT * FROM src_clientes WHERE telefone IS NOT NULL
  ),
  clientes_agg AS (
    SELECT
      telefone,
      (array_agg(cliente_id ORDER BY cliente_id))[1] AS cliente_id,
      (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
      (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
      bool_or(UPPER(COALESCE(tipo_cliente,'')) IN ('ADVECS','IGREJA ADVECS')) AS is_advec,
      bool_or(
        UPPER(COALESCE(tipo_cliente,'')) LIKE '%IGREJA CNPJ%'
        OR (possui_cnpj = true AND UPPER(COALESCE(tipo_cliente,'')) LIKE '%IGREJA%')
      ) AS is_igreja_cnpj,
      bool_or(
        UPPER(COALESCE(tipo_cliente,'')) LIKE '%IGREJA CPF%'
        OR (possui_cnpj = false AND UPPER(COALESCE(tipo_cliente,'')) LIKE '%IGREJA%')
      ) AS is_igreja_cpf
    FROM clientes
    GROUP BY telefone
  ),

  -- pedidos shopify editora
  ped_shopify AS (
    SELECT
      public.normalizar_telefone_whatsapp(customer_phone) AS telefone,
      customer_name AS nome,
      customer_email AS email,
      order_date AS data_pedido
    FROM public.ebd_shopify_pedidos
    WHERE status_pagamento IN ('paid','Faturado')
  ),
  shopify_agg AS (
    SELECT telefone,
      (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
      (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
      MAX(data_pedido) AS ultima,
      COUNT(*) AS qtd
    FROM ped_shopify WHERE telefone IS NOT NULL GROUP BY telefone
  ),

  -- pedidos shopify cg
  ped_shopify_cg AS (
    SELECT
      public.normalizar_telefone_whatsapp(endereco_telefone) AS telefone,
      customer_name AS nome,
      customer_email AS email,
      order_date AS data_pedido
    FROM public.ebd_shopify_pedidos_cg
    WHERE status_pagamento = 'paid'
  ),
  shopify_cg_agg AS (
    SELECT telefone,
      (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
      (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
      MAX(data_pedido) AS ultima,
      COUNT(*) AS qtd
    FROM ped_shopify_cg WHERE telefone IS NOT NULL GROUP BY telefone
  ),

  -- pedidos loja cg
  ped_loja_cg AS (
    SELECT
      public.normalizar_telefone_whatsapp(customer_phone) AS telefone,
      customer_name AS nome,
      customer_email AS email,
      COALESCE(paid_at, order_date) AS data_pedido
    FROM public.ebd_loja_pedidos_cg
    WHERE status_pagamento = 'paid'
  ),
  loja_cg_agg AS (
    SELECT telefone,
      (array_agg(nome) FILTER (WHERE nome IS NOT NULL))[1] AS nome,
      (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
      MAX(data_pedido) AS ultima,
      COUNT(*) AS qtd
    FROM ped_loja_cg WHERE telefone IS NOT NULL GROUP BY telefone
  ),

  -- ebd_pedidos
  ped_ebd AS (
    SELECT
      public.normalizar_telefone_whatsapp(telefone_cliente) AS telefone,
      trim(coalesce(nome_cliente,'') || ' ' || coalesce(sobrenome_cliente,'')) AS nome,
      email_cliente AS email,
      approved_at AS data_pedido
    FROM public.ebd_pedidos
    WHERE payment_status = 'approved'
  ),
  ebd_agg AS (
    SELECT telefone,
      (array_agg(NULLIF(nome,'')) FILTER (WHERE nome IS NOT NULL AND nome <> ''))[1] AS nome,
      (array_agg(email) FILTER (WHERE email IS NOT NULL))[1] AS email,
      MAX(data_pedido) AS ultima,
      COUNT(*) AS qtd
    FROM ped_ebd WHERE telefone IS NOT NULL GROUP BY telefone
  ),

  -- presença em e-commerce (independente de pagamento)
  ecom_phones AS (
    SELECT public.normalizar_telefone_whatsapp(customer_phone) AS telefone FROM public.ebd_shopify_pedidos
    UNION
    SELECT public.normalizar_telefone_whatsapp(endereco_telefone) FROM public.ebd_shopify_pedidos_cg
    UNION
    SELECT public.normalizar_telefone_whatsapp(customer_phone) FROM public.ebd_loja_pedidos_cg
  ),
  ecom_set AS (
    SELECT DISTINCT telefone FROM ecom_phones WHERE telefone IS NOT NULL
  ),

  -- licenciados de revista (shopify direto + via cliente)
  lic_shopify AS (
    SELECT DISTINCT public.normalizar_telefone_whatsapp(whatsapp) AS telefone
    FROM public.revista_licencas_shopify
    WHERE whatsapp IS NOT NULL
  ),
  lic_clientes AS (
    SELECT DISTINCT public.normalizar_telefone_whatsapp(c.telefone) AS telefone
    FROM public.revista_licencas rl
    JOIN public.ebd_clientes c ON c.id = rl.superintendente_id
    WHERE c.telefone IS NOT NULL
  ),
  lic_set AS (
    SELECT telefone FROM lic_shopify WHERE telefone IS NOT NULL
    UNION
    SELECT telefone FROM lic_clientes WHERE telefone IS NOT NULL
  ),

  -- universo de telefones
  todos AS (
    SELECT telefone FROM clientes_agg
    UNION SELECT telefone FROM shopify_agg
    UNION SELECT telefone FROM shopify_cg_agg
    UNION SELECT telefone FROM loja_cg_agg
    UNION SELECT telefone FROM ebd_agg
    UNION SELECT telefone FROM ecom_set
    UNION SELECT telefone FROM lic_set
  )
SELECT
  t.telefone,
  COALESCE(c.nome, scg.nome, sh.nome, lcg.nome, eb.nome) AS nome,
  COALESCE(c.email, scg.email, sh.email, lcg.email, eb.email) AS email,
  c.cliente_id,
  COALESCE(c.is_advec, false) AS is_advec,
  COALESCE(c.is_igreja_cnpj, false) AS is_igreja_cnpj,
  COALESCE(c.is_igreja_cpf, false) AS is_igreja_cpf,
  (ec.telefone IS NOT NULL) AS is_ecommerce,
  (ls.telefone IS NOT NULL) AS is_licenciado_revista,
  GREATEST(
    COALESCE(sh.ultima, 'epoch'::timestamptz),
    COALESCE(scg.ultima, 'epoch'::timestamptz),
    COALESCE(lcg.ultima, 'epoch'::timestamptz),
    COALESCE(eb.ultima, 'epoch'::timestamptz)
  ) AS ultima_compra_em_raw,
  NULLIF(GREATEST(
    COALESCE(sh.ultima, 'epoch'::timestamptz),
    COALESCE(scg.ultima, 'epoch'::timestamptz),
    COALESCE(lcg.ultima, 'epoch'::timestamptz),
    COALESCE(eb.ultima, 'epoch'::timestamptz)
  ), 'epoch'::timestamptz) AS ultima_compra_em,
  CASE WHEN GREATEST(
    COALESCE(sh.ultima, 'epoch'::timestamptz),
    COALESCE(scg.ultima, 'epoch'::timestamptz),
    COALESCE(lcg.ultima, 'epoch'::timestamptz),
    COALESCE(eb.ultima, 'epoch'::timestamptz)
  ) = 'epoch'::timestamptz THEN NULL
  ELSE EXTRACT(DAY FROM (now() - GREATEST(
    COALESCE(sh.ultima, 'epoch'::timestamptz),
    COALESCE(scg.ultima, 'epoch'::timestamptz),
    COALESCE(lcg.ultima, 'epoch'::timestamptz),
    COALESCE(eb.ultima, 'epoch'::timestamptz)
  )))::int END AS dias_sem_comprar,
  (COALESCE(sh.qtd,0) + COALESCE(scg.qtd,0) + COALESCE(lcg.qtd,0) + COALESCE(eb.qtd,0))::int AS total_pedidos,
  (oo.telefone IS NOT NULL) AS tem_optout
FROM todos t
LEFT JOIN clientes_agg c   ON c.telefone = t.telefone
LEFT JOIN shopify_agg sh   ON sh.telefone = t.telefone
LEFT JOIN shopify_cg_agg scg ON scg.telefone = t.telefone
LEFT JOIN loja_cg_agg lcg  ON lcg.telefone = t.telefone
LEFT JOIN ebd_agg eb       ON eb.telefone = t.telefone
LEFT JOIN ecom_set ec      ON ec.telefone = t.telefone
LEFT JOIN lic_set ls       ON ls.telefone = t.telefone
LEFT JOIN public.whatsapp_optouts oo ON oo.telefone = t.telefone;

-- 6) Promover admins a superadmin (continuidade de acesso; pode ser revisado depois)
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'superadmin'::app_role
FROM public.user_roles
WHERE role = 'admin'::app_role
ON CONFLICT (user_id, role) DO NOTHING;
