-- Tabela para armazenar o histórico manual de revistas por cliente
CREATE TABLE public.ebd_historico_revistas_manual (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.ebd_clientes(id) ON DELETE CASCADE,
  revista_id UUID NOT NULL REFERENCES public.ebd_revistas(id) ON DELETE CASCADE,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, revista_id)
);

-- Enable RLS
ALTER TABLE public.ebd_historico_revistas_manual ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all historico_revistas_manual"
  ON public.ebd_historico_revistas_manual
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerente EBD can manage historico_revistas_manual"
  ON public.ebd_historico_revistas_manual
  FOR ALL
  USING (has_role(auth.uid(), 'gerente_ebd'::app_role));

CREATE POLICY "Vendedores can manage historico of their clients"
  ON public.ebd_historico_revistas_manual
  FOR ALL
  USING (
    cliente_id IN (
      SELECT id FROM ebd_clientes 
      WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
    )
  )
  WITH CHECK (
    cliente_id IN (
      SELECT id FROM ebd_clientes 
      WHERE vendedor_id = get_vendedor_id_by_email(get_auth_email())
    )
  );

-- Index for faster lookups
CREATE INDEX idx_historico_revistas_cliente ON public.ebd_historico_revistas_manual(cliente_id);
CREATE INDEX idx_historico_revistas_revista ON public.ebd_historico_revistas_manual(revista_id);