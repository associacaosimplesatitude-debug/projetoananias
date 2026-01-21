-- 1. Adicionar campos na tabela vendedores para hierarquia
ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS gerente_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL;

ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS is_gerente boolean DEFAULT false;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_vendedores_gerente_id ON public.vendedores(gerente_id);

-- 2. Tabela de configuração do Admin
CREATE TABLE IF NOT EXISTS public.comissoes_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL UNIQUE,
  percentual numeric NOT NULL DEFAULT 1.5,
  email_beneficiario text,
  user_id uuid,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.comissoes_config ENABLE ROW LEVEL SECURITY;

-- Apenas admin pode ver/editar config
CREATE POLICY "Admin full access comissoes_config" ON public.comissoes_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- 3. Tabela de comissões hierárquicas (gerentes e admin)
CREATE TABLE IF NOT EXISTS public.comissoes_hierarquicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcela_origem_id uuid REFERENCES public.vendedor_propostas_parcelas(id) ON DELETE CASCADE,
  tipo_beneficiario text NOT NULL,
  beneficiario_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  beneficiario_email text,
  beneficiario_nome text,
  vendedor_origem_id uuid REFERENCES public.vendedores(id) ON DELETE SET NULL,
  vendedor_origem_nome text,
  cliente_id uuid,
  cliente_nome text,
  valor_venda numeric NOT NULL,
  percentual_comissao numeric NOT NULL,
  valor_comissao numeric NOT NULL,
  data_vencimento date NOT NULL,
  data_liberacao date,
  status text DEFAULT 'pendente',
  pago_em timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_comissoes_hierarquicas_tipo ON public.comissoes_hierarquicas(tipo_beneficiario);
CREATE INDEX IF NOT EXISTS idx_comissoes_hierarquicas_status ON public.comissoes_hierarquicas(status);
CREATE INDEX IF NOT EXISTS idx_comissoes_hierarquicas_beneficiario ON public.comissoes_hierarquicas(beneficiario_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_hierarquicas_data ON public.comissoes_hierarquicas(data_vencimento);

-- Habilitar RLS
ALTER TABLE public.comissoes_hierarquicas ENABLE ROW LEVEL SECURITY;

-- Admin vê tudo
CREATE POLICY "Admin full access comissoes_hierarquicas" ON public.comissoes_hierarquicas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Financeiro vê apenas gerentes (NÃO admin)
CREATE POLICY "Financeiro ve gerentes" ON public.comissoes_hierarquicas
  FOR SELECT USING (
    tipo_beneficiario = 'gerente' AND
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'financeiro')
  );

-- Gerente vê suas próprias comissões
CREATE POLICY "Gerente ve suas comissoes" ON public.comissoes_hierarquicas
  FOR SELECT USING (
    tipo_beneficiario = 'gerente' AND
    beneficiario_id IN (
      SELECT id FROM public.vendedores WHERE email = public.get_auth_email()
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_comissoes_config_updated_at
  BEFORE UPDATE ON public.comissoes_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();