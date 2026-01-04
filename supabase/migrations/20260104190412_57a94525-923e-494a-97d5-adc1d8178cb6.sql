-- Enum para roles do EBD
CREATE TYPE public.ebd_role AS ENUM ('professor', 'superintendente');

-- Tabela para múltiplos papéis por usuário no contexto EBD
CREATE TABLE public.ebd_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id UUID NOT NULL,
  role ebd_role NOT NULL,
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, church_id, role)
);

-- Enable RLS
ALTER TABLE public.ebd_user_roles ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX idx_ebd_user_roles_user_id ON public.ebd_user_roles(user_id);
CREATE INDEX idx_ebd_user_roles_church_id ON public.ebd_user_roles(church_id);

-- Função para verificar se usuário tem role específica no EBD
CREATE OR REPLACE FUNCTION public.has_ebd_role(_user_id UUID, _church_id UUID, _role ebd_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_user_roles
    WHERE user_id = _user_id
      AND church_id = _church_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário é superintendente em qualquer igreja
CREATE OR REPLACE FUNCTION public.is_ebd_superintendente(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ebd_user_roles
    WHERE user_id = _user_id
      AND role = 'superintendente'
  )
  OR EXISTS (
    SELECT 1
    FROM public.ebd_clientes
    WHERE superintendente_user_id = _user_id
      AND status_ativacao_ebd = true
  )
$$;

-- Política: Superintendentes podem ver roles da sua igreja
CREATE POLICY "Superintendentes podem ver roles da sua igreja"
ON public.ebd_user_roles
FOR SELECT
TO authenticated
USING (
  -- É superintendente da igreja (via ebd_clientes)
  EXISTS (
    SELECT 1 FROM public.ebd_clientes
    WHERE ebd_clientes.id = ebd_user_roles.church_id
      AND ebd_clientes.superintendente_user_id = auth.uid()
      AND ebd_clientes.status_ativacao_ebd = true
  )
  OR
  -- Já tem role de superintendente nessa igreja
  EXISTS (
    SELECT 1 FROM public.ebd_user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = ebd_user_roles.church_id
      AND ur.role = 'superintendente'
  )
  OR
  -- É o próprio usuário
  user_id = auth.uid()
);

-- Política: Apenas superintendentes podem inserir roles
CREATE POLICY "Superintendentes podem conceder roles"
ON public.ebd_user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  -- É superintendente da igreja (via ebd_clientes)
  EXISTS (
    SELECT 1 FROM public.ebd_clientes
    WHERE ebd_clientes.id = ebd_user_roles.church_id
      AND ebd_clientes.superintendente_user_id = auth.uid()
      AND ebd_clientes.status_ativacao_ebd = true
  )
  OR
  -- Já tem role de superintendente nessa igreja
  EXISTS (
    SELECT 1 FROM public.ebd_user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = ebd_user_roles.church_id
      AND ur.role = 'superintendente'
  )
);

-- Política: Apenas superintendentes podem remover roles
CREATE POLICY "Superintendentes podem remover roles"
ON public.ebd_user_roles
FOR DELETE
TO authenticated
USING (
  -- É superintendente da igreja (via ebd_clientes)
  EXISTS (
    SELECT 1 FROM public.ebd_clientes
    WHERE ebd_clientes.id = ebd_user_roles.church_id
      AND ebd_clientes.superintendente_user_id = auth.uid()
      AND ebd_clientes.status_ativacao_ebd = true
  )
  OR
  -- Já tem role de superintendente nessa igreja
  EXISTS (
    SELECT 1 FROM public.ebd_user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.church_id = ebd_user_roles.church_id
      AND ur.role = 'superintendente'
  )
);

-- Migrar professores existentes com user_id para a nova tabela
INSERT INTO public.ebd_user_roles (user_id, church_id, role)
SELECT DISTINCT p.user_id, p.church_id, 'professor'::ebd_role
FROM public.ebd_professores p
WHERE p.user_id IS NOT NULL
  AND p.is_active = true
ON CONFLICT (user_id, church_id, role) DO NOTHING;

-- Migrar superintendentes existentes para a nova tabela
INSERT INTO public.ebd_user_roles (user_id, church_id, role)
SELECT DISTINCT c.superintendente_user_id, c.id, 'superintendente'::ebd_role
FROM public.ebd_clientes c
WHERE c.superintendente_user_id IS NOT NULL
  AND c.status_ativacao_ebd = true
ON CONFLICT (user_id, church_id, role) DO NOTHING;