-- =====================================================
-- PROTEÇÃO CONTRA DELEÇÃO DE PROPOSTAS COM PAGAMENTO
-- =====================================================

-- 1. Trigger para impedir deleção de propostas que têm pedido MP associado
CREATE OR REPLACE FUNCTION public.prevent_proposta_delete_with_mp_order()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se existe pedido MP vinculado (pago ou pendente)
  IF EXISTS (
    SELECT 1 FROM public.ebd_shopify_pedidos_mercadopago 
    WHERE proposta_id = OLD.id 
    AND status IN ('PAGO', 'PENDENTE', 'AGUARDANDO_PAGAMENTO')
  ) THEN
    RAISE EXCEPTION 'Não é possível excluir proposta com pagamento associado. Proposta ID: %', OLD.id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_prevent_proposta_delete ON public.vendedor_propostas;
CREATE TRIGGER trg_prevent_proposta_delete
  BEFORE DELETE ON public.vendedor_propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_proposta_delete_with_mp_order();

-- =====================================================
-- TABELA DE AUDITORIA PARA DELEÇÕES
-- =====================================================

-- 2. Criar tabela de auditoria para propostas
CREATE TABLE IF NOT EXISTS public.vendedor_propostas_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL,
  action text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  user_id uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS para auditoria (apenas admins podem ver)
ALTER TABLE public.vendedor_propostas_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins podem ver auditoria de propostas"
  ON public.vendedor_propostas_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Trigger para registrar deleções na auditoria
CREATE OR REPLACE FUNCTION public.audit_proposta_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.vendedor_propostas_audit (proposta_id, action, old_data, user_id)
    VALUES (OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_audit_propostas ON public.vendedor_propostas;
CREATE TRIGGER trg_audit_propostas
  AFTER DELETE ON public.vendedor_propostas
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_proposta_changes();