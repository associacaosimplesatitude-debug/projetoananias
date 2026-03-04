
CREATE TABLE public.comissoes_alfamarketing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia DATE NOT NULL,
  canal TEXT NOT NULL,
  valor_bruto NUMERIC NOT NULL DEFAULT 0,
  valor_comissao NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mes_referencia, canal)
);

ALTER TABLE public.comissoes_alfamarketing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can read comissoes_alfamarketing"
  ON public.comissoes_alfamarketing FOR SELECT
  TO authenticated
  USING (public.is_admin_geral(auth.uid()));

CREATE POLICY "Admin can insert comissoes_alfamarketing"
  ON public.comissoes_alfamarketing FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_geral(auth.uid()));

CREATE POLICY "Admin can update comissoes_alfamarketing"
  ON public.comissoes_alfamarketing FOR UPDATE
  TO authenticated
  USING (public.is_admin_geral(auth.uid()));

CREATE POLICY "Admin can delete comissoes_alfamarketing"
  ON public.comissoes_alfamarketing FOR DELETE
  TO authenticated
  USING (public.is_admin_geral(auth.uid()));
