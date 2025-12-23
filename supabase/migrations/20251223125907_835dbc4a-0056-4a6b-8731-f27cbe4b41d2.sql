-- Enable realtime for ebd_shopify_pedidos table
ALTER TABLE public.ebd_shopify_pedidos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ebd_shopify_pedidos;

-- Enable realtime for ebd_shopify_pedidos_cg table
ALTER TABLE public.ebd_shopify_pedidos_cg REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ebd_shopify_pedidos_cg;