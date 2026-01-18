-- Backfill: Atualizar parcelas de comissão online/mercadopago com dados da NF
-- Vinculando pelo email do cliente
UPDATE vendedor_propostas_parcelas vpp
SET 
  link_danfe = esp.nota_fiscal_url,
  nota_fiscal_numero = esp.nota_fiscal_numero,
  shopify_pedido_id = esp.id
FROM ebd_clientes ec
JOIN ebd_shopify_pedidos esp ON LOWER(ec.email_superintendente) = LOWER(esp.customer_email)
WHERE vpp.cliente_id = ec.id
  AND vpp.origem IN ('online', 'mercadopago')
  AND vpp.link_danfe IS NULL
  AND esp.nota_fiscal_url IS NOT NULL
  AND ABS(EXTRACT(EPOCH FROM (esp.created_at - vpp.created_at))) < 604800;