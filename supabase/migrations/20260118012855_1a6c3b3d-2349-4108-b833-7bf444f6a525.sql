-- Backfill cliente_id em ebd_shopify_pedidos usando email
UPDATE public.ebd_shopify_pedidos esp
SET cliente_id = ec.id
FROM public.ebd_clientes ec
WHERE esp.cliente_id IS NULL
  AND esp.customer_email IS NOT NULL
  AND LOWER(TRIM(esp.customer_email)) = LOWER(TRIM(ec.email_superintendente));

-- Backfill shopify_pedido_id nas parcelas online/mercadopago
-- Match por cliente + valor próximo + data próxima
UPDATE public.vendedor_propostas_parcelas vpp
SET shopify_pedido_id = matched.pedido_id
FROM (
  SELECT DISTINCT ON (vpp2.id)
    vpp2.id as parcela_id,
    esp.id as pedido_id
  FROM public.vendedor_propostas_parcelas vpp2
  JOIN public.vendedor_propostas vp ON vp.id = vpp2.proposta_id
  JOIN public.ebd_shopify_pedidos esp ON esp.cliente_id = vp.cliente_id
  WHERE vpp2.shopify_pedido_id IS NULL
    AND vpp2.origem IN ('online', 'mercadopago')
    AND ABS(vpp2.valor - esp.valor_total) < 5
    AND ABS(EXTRACT(EPOCH FROM (vpp2.data_vencimento::timestamp - esp.order_date::timestamp)) / 86400) < 30
  ORDER BY vpp2.id, ABS(vpp2.valor - esp.valor_total), ABS(EXTRACT(EPOCH FROM (vpp2.data_vencimento::timestamp - esp.order_date::timestamp)))
) matched
WHERE vpp.id = matched.parcela_id
  AND vpp.shopify_pedido_id IS NULL;