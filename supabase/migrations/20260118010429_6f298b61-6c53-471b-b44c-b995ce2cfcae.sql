-- Backfill: Atualizar parcelas de comissão online/mercadopago com dados da NF
-- Vinculando pelo cliente_id e intervalo de data
UPDATE vendedor_propostas_parcelas vpp
SET 
  link_danfe = esp.nota_fiscal_url,
  nota_fiscal_numero = esp.nota_fiscal_numero
FROM ebd_shopify_pedidos esp
WHERE vpp.cliente_id = esp.cliente_id
  AND vpp.origem IN ('online', 'mercadopago')
  AND vpp.link_danfe IS NULL
  AND esp.nota_fiscal_url IS NOT NULL
  AND esp.created_at >= vpp.created_at - INTERVAL '7 days'
  AND esp.created_at <= vpp.created_at + INTERVAL '1 day';