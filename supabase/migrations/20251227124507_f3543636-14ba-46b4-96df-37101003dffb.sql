-- Create enum for tutorial profiles
CREATE TYPE public.tutorial_perfil AS ENUM (
  'VENDEDORES',
  'GERENTES',
  'FINANCEIRO',
  'PROFESSORES',
  'ALUNOS',
  'SUPERINTENDENTES',
  'ADMINISTRADOR_GERAL'
);

-- Create tutoriais table
CREATE TABLE public.tutoriais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  link_video TEXT NOT NULL,
  descricao TEXT,
  categorias TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tutoriais_perfis association table
CREATE TABLE public.tutoriais_perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutorial_id UUID NOT NULL REFERENCES public.tutoriais(id) ON DELETE CASCADE,
  perfil tutorial_perfil NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tutorial_id, perfil)
);

-- Enable RLS
ALTER TABLE public.tutoriais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoriais_perfis ENABLE ROW LEVEL SECURITY;

-- RLS policies for tutoriais
CREATE POLICY "Admins can manage all tutoriais"
ON public.tutoriais
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view tutoriais"
ON public.tutoriais
FOR SELECT
USING (true);

-- RLS policies for tutoriais_perfis
CREATE POLICY "Admins can manage all tutoriais_perfis"
ON public.tutoriais_perfis
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view tutoriais_perfis"
ON public.tutoriais_perfis
FOR SELECT
USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_tutoriais_updated_at
BEFORE UPDATE ON public.tutoriais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();