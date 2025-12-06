-- Add gamification fields to ebd_alunos
ALTER TABLE public.ebd_alunos
ADD COLUMN IF NOT EXISTS aulas_seguidas INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS nivel VARCHAR(50) NOT NULL DEFAULT 'Bronze',
ADD COLUMN IF NOT EXISTS conquistas JSONB DEFAULT '[]'::jsonb;

-- Create ebd_leituras table for daily reading tracking
CREATE TABLE IF NOT EXISTS public.ebd_leituras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  church_id UUID NOT NULL,
  licao_id UUID REFERENCES public.ebd_licoes(id) ON DELETE SET NULL,
  data_leitura DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'incompleto',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(aluno_id, data_leitura)
);

-- Create ebd_anotacoes table for student notes
CREATE TABLE IF NOT EXISTS public.ebd_anotacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  aluno_id UUID NOT NULL REFERENCES public.ebd_alunos(id) ON DELETE CASCADE,
  church_id UUID NOT NULL,
  licao_id UUID REFERENCES public.ebd_licoes(id) ON DELETE SET NULL,
  titulo TEXT,
  conteudo TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ebd_materiais table for teacher materials
CREATE TABLE IF NOT EXISTS public.ebd_materiais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  turma_id UUID NOT NULL REFERENCES public.ebd_turmas(id) ON DELETE CASCADE,
  church_id UUID NOT NULL,
  licao_id UUID REFERENCES public.ebd_licoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  arquivo_url TEXT,
  tipo TEXT NOT NULL DEFAULT 'documento',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.ebd_leituras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_anotacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ebd_materiais ENABLE ROW LEVEL SECURITY;

-- RLS policies for ebd_leituras
CREATE POLICY "Admins can manage all leituras" ON public.ebd_leituras
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their leituras" ON public.ebd_leituras
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

CREATE POLICY "Students can manage their own leituras" ON public.ebd_leituras
  FOR ALL USING (aluno_id IN (SELECT id FROM ebd_alunos WHERE user_id = auth.uid()))
  WITH CHECK (aluno_id IN (SELECT id FROM ebd_alunos WHERE user_id = auth.uid()));

-- RLS policies for ebd_anotacoes
CREATE POLICY "Admins can manage all anotacoes" ON public.ebd_anotacoes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can view anotacoes" ON public.ebd_anotacoes
  FOR SELECT USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

CREATE POLICY "Students can manage their own anotacoes" ON public.ebd_anotacoes
  FOR ALL USING (aluno_id IN (SELECT id FROM ebd_alunos WHERE user_id = auth.uid()))
  WITH CHECK (aluno_id IN (SELECT id FROM ebd_alunos WHERE user_id = auth.uid()));

-- RLS policies for ebd_materiais
CREATE POLICY "Admins can manage all materiais" ON public.ebd_materiais
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Church owners can manage their materiais" ON public.ebd_materiais
  FOR ALL USING (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()))
  WITH CHECK (church_id IN (SELECT id FROM churches WHERE user_id = auth.uid()));

CREATE POLICY "Students can view materiais from their turma" ON public.ebd_materiais
  FOR SELECT USING (turma_id IN (SELECT turma_id FROM ebd_alunos WHERE user_id = auth.uid()));