-- =============================================
-- FASE 1A - PARTE 1: Schema base do módulo Royalties
-- =============================================

-- 1. Adicionar novos valores ao enum app_role existente
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'autor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_royalties';

-- 2. Criar enums específicos do módulo
CREATE TYPE public.royalties_periodo_pagamento AS ENUM ('1_mes', '3_meses', '6_meses', '1_ano');
CREATE TYPE public.royalties_pagamento_status AS ENUM ('pendente', 'pago', 'cancelado');

-- 3. Criar tabela de autores
CREATE TABLE public.royalties_autores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  nome_completo TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cpf_cnpj TEXT,
  telefone TEXT,
  endereco JSONB DEFAULT '{}'::jsonb,
  dados_bancarios JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Criar tabela de livros
CREATE TABLE public.royalties_livros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT,
  capa_url TEXT,
  valor_capa NUMERIC(10,2) NOT NULL DEFAULT 0,
  autor_id UUID REFERENCES public.royalties_autores(id) ON DELETE CASCADE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Criar tabela de comissões (configuração por livro)
CREATE TABLE public.royalties_comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id UUID REFERENCES public.royalties_livros(id) ON DELETE CASCADE NOT NULL UNIQUE,
  percentual NUMERIC(5,2) NOT NULL DEFAULT 10,
  periodo_pagamento public.royalties_periodo_pagamento DEFAULT '1_mes',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. Criar tabela de vendas
CREATE TABLE public.royalties_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  livro_id UUID REFERENCES public.royalties_livros(id) ON DELETE CASCADE NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_unitario NUMERIC(10,2) NOT NULL,
  valor_comissao_unitario NUMERIC(10,2) NOT NULL,
  valor_comissao_total NUMERIC(10,2) NOT NULL,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  pagamento_id UUID,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. Criar tabela de pagamentos
CREATE TABLE public.royalties_pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id UUID REFERENCES public.royalties_autores(id) ON DELETE CASCADE NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  data_prevista DATE NOT NULL,
  data_efetivacao DATE,
  status public.royalties_pagamento_status DEFAULT 'pendente',
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 8. Adicionar FK de vendas para pagamentos (após criar tabela de pagamentos)
ALTER TABLE public.royalties_vendas 
ADD CONSTRAINT royalties_vendas_pagamento_id_fkey 
FOREIGN KEY (pagamento_id) REFERENCES public.royalties_pagamentos(id) ON DELETE SET NULL;

-- 9. Criar tabela de auditoria
CREATE TABLE public.royalties_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  acao TEXT NOT NULL,
  tabela TEXT NOT NULL,
  registro_id UUID,
  dados_antigos JSONB,
  dados_novos JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 10. Criar índices para performance
CREATE INDEX idx_royalties_autores_user_id ON public.royalties_autores(user_id);
CREATE INDEX idx_royalties_autores_email ON public.royalties_autores(email);
CREATE INDEX idx_royalties_livros_autor_id ON public.royalties_livros(autor_id);
CREATE INDEX idx_royalties_vendas_livro_id ON public.royalties_vendas(livro_id);
CREATE INDEX idx_royalties_vendas_data ON public.royalties_vendas(data_venda);
CREATE INDEX idx_royalties_vendas_pagamento_id ON public.royalties_vendas(pagamento_id);
CREATE INDEX idx_royalties_pagamentos_autor_id ON public.royalties_pagamentos(autor_id);
CREATE INDEX idx_royalties_pagamentos_status ON public.royalties_pagamentos(status);
CREATE INDEX idx_royalties_audit_logs_tabela ON public.royalties_audit_logs(tabela);

-- 11. Triggers para updated_at
CREATE TRIGGER update_royalties_autores_updated_at
  BEFORE UPDATE ON public.royalties_autores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_royalties_livros_updated_at
  BEFORE UPDATE ON public.royalties_livros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_royalties_pagamentos_updated_at
  BEFORE UPDATE ON public.royalties_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Habilitar RLS em todas as tabelas
ALTER TABLE public.royalties_autores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_livros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.royalties_audit_logs ENABLE ROW LEVEL SECURITY;

-- 13. Criar storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('royalties-capas', 'royalties-capas', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('royalties-comprovantes', 'royalties-comprovantes', false);