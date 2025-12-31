-- Sistema de Créditos para Clientes EBD
CREATE TABLE public.ebd_creditos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'cupom_aniversario', 'bonus_indicacao', etc.
  valor NUMERIC NOT NULL DEFAULT 0,
  descricao TEXT,
  validade DATE,
  usado BOOLEAN NOT NULL DEFAULT false,
  usado_em TIMESTAMP WITH TIME ZONE,
  pedido_id UUID, -- Referência ao pedido onde foi usado
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ebd_creditos_cliente ON public.ebd_creditos(cliente_id);
CREATE INDEX idx_ebd_creditos_tipo ON public.ebd_creditos(tipo);
CREATE INDEX idx_ebd_creditos_usado ON public.ebd_creditos(usado);

-- Enable RLS
ALTER TABLE public.ebd_creditos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all creditos"
ON public.ebd_creditos FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerente EBD can manage creditos"
ON public.ebd_creditos FOR ALL
USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Vendedores can view creditos of their clients"
ON public.ebd_creditos FOR SELECT
USING (cliente_id IN (
  SELECT id FROM public.ebd_clientes 
  WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
));

CREATE POLICY "Superintendentes can view their own creditos"
ON public.ebd_creditos FOR SELECT
USING (cliente_id IN (
  SELECT id FROM public.ebd_clientes 
  WHERE superintendente_user_id = auth.uid()
));

CREATE POLICY "Superintendentes can use their own creditos"
ON public.ebd_creditos FOR UPDATE
USING (cliente_id IN (
  SELECT id FROM public.ebd_clientes 
  WHERE superintendente_user_id = auth.uid()
))
WITH CHECK (cliente_id IN (
  SELECT id FROM public.ebd_clientes 
  WHERE superintendente_user_id = auth.uid()
));

-- Trigger para updated_at
CREATE TRIGGER update_ebd_creditos_updated_at
  BEFORE UPDATE ON public.ebd_creditos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Adicionar campo para controlar se já resgatou cupom de aniversário no ano
-- (já existe cupom_aniversario_ano e cupom_aniversario_usado em ebd_clientes)

-- Adicionar campo para tracking de visualização do modal de aniversário
ALTER TABLE public.ebd_clientes 
ADD COLUMN IF NOT EXISTS modal_aniversario_visualizado_em TIMESTAMP WITH TIME ZONE;