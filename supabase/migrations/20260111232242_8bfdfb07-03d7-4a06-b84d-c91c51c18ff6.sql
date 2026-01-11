-- Adicionar campo ordem na tabela tutoriais
ALTER TABLE public.tutoriais ADD COLUMN IF NOT EXISTS ordem INTEGER DEFAULT 0;

-- Atualizar tutoriais existentes com ordem baseada na criação
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as new_ordem
  FROM public.tutoriais
)
UPDATE public.tutoriais t
SET ordem = o.new_ordem
FROM ordered o
WHERE t.id = o.id;

-- Criar tabela de visualizações de tutoriais
CREATE TABLE public.tutorial_visualizacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID REFERENCES public.tutoriais(id) ON DELETE CASCADE NOT NULL,
  vendedor_id UUID REFERENCES public.vendedores(id) ON DELETE CASCADE NOT NULL,
  assistido_em TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(tutorial_id, vendedor_id)
);

-- Habilitar RLS
ALTER TABLE public.tutorial_visualizacoes ENABLE ROW LEVEL SECURITY;

-- Política: Vendedores podem inserir suas próprias visualizações
CREATE POLICY "Vendedores podem inserir visualizacoes"
ON public.tutorial_visualizacoes 
FOR INSERT TO authenticated
WITH CHECK (
  vendedor_id IN (
    SELECT id FROM public.vendedores 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Política: Vendedores podem ver suas próprias visualizações
CREATE POLICY "Vendedores podem ver suas visualizacoes"
ON public.tutorial_visualizacoes 
FOR SELECT TO authenticated
USING (
  vendedor_id IN (
    SELECT id FROM public.vendedores 
    WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Política: Admins e gerentes podem ver todas as visualizações
CREATE POLICY "Admins podem ver todas visualizacoes"
ON public.tutorial_visualizacoes 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) 
  OR public.has_role(auth.uid(), 'gerente_ebd'::public.app_role)
);