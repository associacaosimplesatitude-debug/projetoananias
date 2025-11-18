-- Adicionar coluna church_id na tabela profiles para vincular usuários a igrejas
ALTER TABLE public.profiles 
ADD COLUMN church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE;

-- Criar índice para melhorar performance
CREATE INDEX idx_profiles_church_id ON public.profiles(church_id);

-- Atualizar políticas RLS para profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Usuários podem ver seu próprio perfil
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Pastores podem ver perfis dos membros de sua igreja
CREATE POLICY "Church owners can view their members"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Usuários podem atualizar seu próprio perfil
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Pastores podem inserir membros em sua igreja
CREATE POLICY "Church owners can insert members"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Pastores podem deletar membros de sua igreja
CREATE POLICY "Church owners can delete members"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  church_id IN (
    SELECT id FROM public.churches WHERE user_id = auth.uid()
  )
);

-- Atualizar políticas de user_roles
-- Pastores podem gerenciar roles dos membros de sua igreja
CREATE POLICY "Church owners can manage member roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE church_id IN (
      SELECT id FROM public.churches WHERE user_id = auth.uid()
    )
  )
);