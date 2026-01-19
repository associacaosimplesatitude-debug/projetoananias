-- ═══════════════════════════════════════════════════════════════
-- Atualizar RLS de ebd_shopify_pedidos_mercadopago 
-- para permitir gerente_ebd, financeiro, admin_geral ver todos
-- ═══════════════════════════════════════════════════════════════

-- Remover política existente que só cobre admin
DROP POLICY IF EXISTS "Admins podem ver todos os pedidos" ON public.ebd_shopify_pedidos_mercadopago;

-- Criar nova política que inclui gerente_ebd e outros roles administrativos
CREATE POLICY "Gerentes e Admins podem ver todos os pedidos"
  ON public.ebd_shopify_pedidos_mercadopago
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
    OR public.has_role(auth.uid(), 'financeiro'::public.app_role)
  );